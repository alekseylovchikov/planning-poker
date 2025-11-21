/**
 * Пример WebSocket сервера для Planning Poker
 *
 * Запуск: node server-example.js
 *
 * Требуется установка: npm install ws
 */

import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

// Создаем HTTP сервер для health check и статических файлов
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "planning-poker" }));
    return;
  }

  // Раздача статических файлов из dist
  let filePath = join(
    __dirname,
    "dist",
    req.url === "/" ? "index.html" : req.url
  );

  // Убираем query параметры из пути
  if (filePath.includes("?")) {
    filePath = filePath.split("?")[0];
  }

  // Если файл не найден, отдаем index.html (для SPA routing)
  if (!existsSync(filePath)) {
    filePath = join(__dirname, "dist", "index.html");
  }

  if (existsSync(filePath)) {
    const ext = filePath.split(".").pop();
    const contentTypes = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (err) {
      console.error("Error serving file:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

// Создаем WebSocket сервер на том же HTTP сервере
const wss = new WebSocketServer({ server });

// Хранилище состояния комнат: roomId -> GameState
const rooms = new Map();

// Функция для генерации уникального ID
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Создание новой комнаты
function createRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: [],
      votesRevealed: false,
      currentVotes: {},
      roomId: roomId,
    });
  }
  return rooms.get(roomId);
}

// Функция для получения безопасного состояния для конкретного клиента
function getSafeState(client, roomId) {
  const roomState = rooms.get(roomId);
  if (!roomState) return null;

  try {
    // Клонируем состояние, чтобы не мутировать оригинал
    const clientState = JSON.parse(JSON.stringify(roomState));

    // Если карты не открыты, скрываем голоса других участников
    if (!clientState.votesRevealed) {
      clientState.participants.forEach((p) => {
        // Скрываем голос, если это не текущий пользователь
        if (p.id !== client.userId) {
          delete p.vote;
        }
      });

      // Пересобираем currentVotes, оставляя только голос текущего пользователя
      const userVote = clientState.currentVotes[client.userId];
      clientState.currentVotes = {};
      if (userVote) {
        clientState.currentVotes[client.userId] = userVote;
      }
    }

    return clientState;
  } catch (error) {
    console.error(`Error in getSafeState for room ${roomId}:`, error);
    return null;
  }
}

// Функция для отправки состояния всем клиентам в комнате
function broadcastState(roomId) {
  const roomState = rooms.get(roomId);
  if (!roomState) return;

  wss.clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
        const safeState = getSafeState(client, roomId);
        if (safeState) {
          client.send(
            JSON.stringify({
              type: "state",
              payload: safeState,
            })
          );
        }
      }
    } catch (error) {
      console.error(`Error broadcasting to client in room ${roomId}:`, error);
    }
  });
}

// Функция для обновления статуса онлайн
function updateOnlineStatus() {
  try {
    rooms.forEach((gameState, roomId) => {
      gameState.participants.forEach((participant) => {
        participant.isOnline = false;
      });

      wss.clients.forEach((ws) => {
        if (
          ws.userId &&
          ws.roomId === roomId &&
          ws.readyState === WebSocket.OPEN
        ) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId
          );
          if (participant) {
            participant.isOnline = true;
          }
        }
      });

      broadcastState(roomId);
    });
  } catch (error) {
    console.error("Error in updateOnlineStatus:", error);
  }
}

wss.on("connection", (ws) => {
  console.log("Новое подключение WebSocket");
  ws.userId = null; // Инициализируем userId как null
  ws.roomId = null;

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join": {
          const { name, roomId: requestedRoomId } = message.payload || {};

          if (!name || typeof name !== "string" || name.trim() === "") {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { message: "Имя не может быть пустым" },
              })
            );
            return;
          }

          let roomId = requestedRoomId;
          if (!roomId) {
            roomId = generateId();
            console.log(`Создана новая комната: ${roomId}`);
          }

          // Проверяем существование комнаты или создаем новую
          let gameState = rooms.get(roomId);
          if (!gameState) {
            if (requestedRoomId) {
              console.log(`Комната ${roomId} не найдена, создаем новую.`);
            }
            gameState = createRoom(roomId);
          }

          ws.roomId = roomId;
          const trimmedName = name.trim();

          // Проверяем, есть ли уже участник с таким именем в ЭТОЙ комнате
          const existingParticipant = gameState.participants.find(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
          );

          if (existingParticipant) {
            // Проверяем, есть ли активное соединение с этим участником в ЭТОЙ комнате
            let hasActiveConnection = false;
            wss.clients.forEach((client) => {
              if (
                client !== ws &&
                client.userId === existingParticipant.id &&
                client.roomId === roomId
              ) {
                if (client.readyState === WebSocket.OPEN) {
                  hasActiveConnection = true;
                }
              }
            });

            if (hasActiveConnection) {
              ws.send(JSON.stringify({ type: "name_taken" }));
              return;
            } else {
              // Переподключение
              wss.clients.forEach((client) => {
                if (
                  client !== ws &&
                  client.userId === existingParticipant.id &&
                  client.roomId === roomId
                ) {
                  try {
                    client.close();
                  } catch (e) {
                    console.error("Error closing old connection:", e);
                  }
                }
              });

              existingParticipant.isOnline = true;
              ws.userId = existingParticipant.id;
              broadcastState(roomId);
            }
          } else {
            // Создание нового участника
            const participant = {
              id: generateId(),
              name: trimmedName,
              isOnline: true,
              vote: undefined,
              hasVoted: false,
            };

            ws.userId = participant.id;
            gameState.participants.push(participant);
          }

          // Отправляем состояние новому участнику
          try {
            const safeState = getSafeState(ws, roomId);
            if (safeState) {
              ws.send(
                JSON.stringify({
                  type: "state",
                  payload: safeState,
                })
              );
            }
          } catch (e) {
            console.error("Error sending initial state:", e);
          }

          // Отправляем состояние всем остальным в комнате
          broadcastState(roomId);
          break;
        }

        case "vote": {
          if (!ws.roomId || !ws.userId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          const { vote } = message.payload || {};
          if (!vote) return;

          const participant = gameState.participants.find(
            (p) => p.id === ws.userId
          );

          if (participant) {
            participant.vote = vote;
            participant.hasVoted = true;
            gameState.currentVotes[participant.id] = vote;
            broadcastState(ws.roomId);
          }
          break;
        }

        case "reset": {
          if (!ws.roomId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          gameState.participants.forEach((participant) => {
            participant.vote = undefined;
            participant.hasVoted = false;
          });
          gameState.votesRevealed = false;
          gameState.currentVotes = {};
          broadcastState(ws.roomId);
          break;
        }

        case "reveal": {
          if (!ws.roomId) return;
          const gameState = rooms.get(ws.roomId);
          if (!gameState) return;

          gameState.votesRevealed = true;
          broadcastState(ws.roomId);
          break;
        }
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения:", error);
    }
  });

  ws.on("close", () => {
    try {
      if (ws.roomId && ws.userId) {
        const gameState = rooms.get(ws.roomId);
        if (gameState) {
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId
          );
          if (participant) {
            participant.isOnline = false;
          }
        }
      }
      // Используем nextTick или setTimeout, чтобы обновление произошло после закрытия
      setTimeout(updateOnlineStatus, 100);
    } catch (error) {
      console.error("Error in close handler:", error);
    }
  });
});

// Периодическое обновление статуса онлайн
setInterval(updateOnlineStatus, 5000);

// Запускаем HTTP сервер
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`HTTP сервер: http://localhost:${PORT}`);
  console.log(`WebSocket сервер: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
