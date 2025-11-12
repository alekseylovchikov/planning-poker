/**
 * Пример WebSocket сервера для Planning Poker
 * 
 * Запуск: node server-example.js
 * 
 * Требуется установка: npm install ws
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;

// Создаем HTTP сервер для health check и статических файлов
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'planning-poker' }));
    return;
  }

  // Раздача статических файлов из dist
  let filePath = join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
  
  // Убираем query параметры из пути
  if (filePath.includes('?')) {
    filePath = filePath.split('?')[0];
  }
  
  // Если файл не найден, отдаем index.html (для SPA routing)
  if (!existsSync(filePath)) {
    filePath = join(__dirname, 'dist', 'index.html');
  }

  if (existsSync(filePath)) {
    const ext = filePath.split('.').pop();
    const contentTypes = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (err) {
      console.error('Error serving file:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
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
    type: 'state',
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

wss.on('connection', (ws) => {
  console.log('Новое подключение');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join': {
          const { name } = message.payload;
          
          // Проверяем, есть ли уже участник с таким именем (офлайн)
          const existingParticipant = gameState.participants.find(
            (p) => p.name.toLowerCase() === name.toLowerCase()
          );
          
          if (existingParticipant) {
            // Если участник уже существует и офлайн, переподключаем его
            if (!existingParticipant.isOnline) {
              existingParticipant.isOnline = true;
              ws.userId = existingParticipant.id;
              console.log(`Участник переподключился: ${name} (${existingParticipant.id})`);
              broadcastState();
              break;
            } else {
              // Если участник онлайн, имя занято
              ws.send(JSON.stringify({ type: 'name_taken' }));
              return;
            }
          }
          
          // Создание нового участника
          const participant = {
            id: generateId(),
            name,
            isOnline: true,
            vote: undefined,
            hasVoted: false,
          };
          
          ws.userId = participant.id;
          gameState.participants.push(participant);
          
          console.log(`Участник присоединился: ${name} (${participant.id})`);
          broadcastState();
          break;
        }
        
        case 'vote': {
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
        
        case 'reset': {
          gameState.participants.forEach((participant) => {
            participant.vote = undefined;
            participant.hasVoted = false;
          });
          gameState.votesRevealed = false;
          gameState.currentVotes = {};
          console.log('Голоса сброшены');
          broadcastState();
          break;
        }
        
        case 'reveal': {
          gameState.votesRevealed = true;
          console.log('Карты открыты');
          broadcastState();
          break;
        }
      }
    } catch (error) {
      console.error('Ошибка обработки сообщения:', error);
    }
  });

  ws.on('close', () => {
    console.log('Клиент отключился');
    updateOnlineStatus();
  });

  // Отправка текущего состояния новому клиенту
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'state',
      payload: gameState,
    }));
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

