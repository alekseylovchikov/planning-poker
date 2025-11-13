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

// Хранилище состояния игры
let gameState = {
  participants: [],
  votesRevealed: false,
  currentVotes: {},
};

// Функция для генерации уникального ID
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Функция для отправки состояния всем клиентам
function broadcastState() {
  const message = JSON.stringify({
    type: "state",
    payload: gameState,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Функция для обновления статуса онлайн
function updateOnlineStatus() {
  gameState.participants.forEach((participant) => {
    participant.isOnline = false;
  });

  wss.clients.forEach((ws) => {
    if (ws.userId && ws.readyState === WebSocket.OPEN) {
      const participant = gameState.participants.find(
        (p) => p.id === ws.userId
      );
      if (participant) {
        participant.isOnline = true;
      }
    }
  });

  broadcastState();
}

wss.on("connection", (ws) => {
  console.log("Новое подключение WebSocket");
  ws.userId = null; // Инициализируем userId как null

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join": {
          const { name } = message.payload;

          if (!name || name.trim() === "") {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { message: "Имя не может быть пустым" },
              })
            );
            return;
          }

          const trimmedName = name.trim();
          console.log(`Попытка присоединения: "${trimmedName}"`);
          console.log(
            `Текущие участники: ${gameState.participants
              .map((p) => `${p.name} (${p.id}, online: ${p.isOnline})`)
              .join(", ")}`
          );

          // Проверяем, есть ли уже участник с таким именем
          const existingParticipant = gameState.participants.find(
            (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
          );

          if (existingParticipant) {
            console.log(
              `Найден существующий участник: ${existingParticipant.name} (${existingParticipant.id})`
            );

            // Проверяем, есть ли активное соединение с этим участником (исключая текущее соединение)
            let hasActiveConnection = false;
            let activeConnections = [];
            wss.clients.forEach((client) => {
              // Исключаем текущее соединение из проверки
              if (client !== ws && client.userId === existingParticipant.id) {
                activeConnections.push({
                  userId: client.userId,
                  readyState: client.readyState,
                  isOpen: client.readyState === WebSocket.OPEN,
                });
                if (client.readyState === WebSocket.OPEN) {
                  hasActiveConnection = true;
                }
              }
            });

            console.log(
              `Активные соединения для ${existingParticipant.id} (исключая текущее):`,
              activeConnections
            );
            console.log(`hasActiveConnection: ${hasActiveConnection}`);

            if (hasActiveConnection) {
              // Если есть активное соединение (не текущее), имя занято
              console.log(
                `Имя "${trimmedName}" занято - есть активное соединение`
              );
              ws.send(JSON.stringify({ type: "name_taken" }));
              return;
            } else {
              // Если нет активного соединения, переподключаем участника
              console.log(
                `Переподключение участника: ${trimmedName} (${existingParticipant.id})`
              );

              // Закрываем все старые соединения с этим userId (если они есть)
              wss.clients.forEach((client) => {
                if (client !== ws && client.userId === existingParticipant.id) {
                  console.log(
                    `Закрываем старое соединение для ${existingParticipant.id}`
                  );
                  client.close();
                }
              });

              existingParticipant.isOnline = true;
              ws.userId = existingParticipant.id;
              console.log(
                `Участник переподключился: ${trimmedName} (${existingParticipant.id})`
              );
              broadcastState();
              break;
            }
          }

          // Создание нового участника
          console.log(`Создание нового участника: "${trimmedName}"`);
          const participant = {
            id: generateId(),
            name: trimmedName,
            isOnline: true,
            vote: undefined,
            hasVoted: false,
          };

          ws.userId = participant.id;
          gameState.participants.push(participant);

          console.log(
            `Участник присоединился: ${trimmedName} (${participant.id})`
          );
          console.log(`Всего участников: ${gameState.participants.length}`);

          // Отправляем состояние новому участнику
          ws.send(
            JSON.stringify({
              type: "state",
              payload: gameState,
            })
          );

          // Отправляем состояние всем остальным
          broadcastState();
          break;
        }

        case "vote": {
          const { vote } = message.payload;
          const participant = gameState.participants.find(
            (p) => p.id === ws.userId
          );

          if (participant) {
            participant.vote = vote;
            participant.hasVoted = true;
            gameState.currentVotes[participant.id] = vote;
            console.log(`${participant.name} проголосовал: ${vote}`);
            broadcastState();
          }
          break;
        }

        case "reset": {
          gameState.participants.forEach((participant) => {
            participant.vote = undefined;
            participant.hasVoted = false;
          });
          gameState.votesRevealed = false;
          gameState.currentVotes = {};
          console.log("Голоса сброшены");
          broadcastState();
          break;
        }

        case "reveal": {
          gameState.votesRevealed = true;
          console.log("Карты открыты");
          broadcastState();
          break;
        }
      }
    } catch (error) {
      console.error("Ошибка обработки сообщения:", error);
    }
  });

  ws.on("close", () => {
    console.log(`Клиент отключился, userId: ${ws.userId || "не установлен"}`);
    // Сразу обновляем статус отключившегося участника
    if (ws.userId) {
      const participant = gameState.participants.find(
        (p) => p.id === ws.userId
      );
      if (participant) {
        participant.isOnline = false;
        console.log(
          `Участник ${participant.name} (${participant.id}) помечен как офлайн`
        );
      }
    }
    // Обновляем статусы всех участников
    updateOnlineStatus();
  });

  // Отправка текущего состояния новому клиенту
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "state",
        payload: gameState,
      })
    );
  }
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
