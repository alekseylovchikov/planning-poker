/**
 * Пример WebSocket сервера для Planning Poker
 * 
 * Запуск: node server-example.js
 * 
 * Требуется установка: npm install ws
 */

import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

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
          
          // Проверка на уникальность имени
          const nameExists = gameState.participants.some(
            (p) => p.name.toLowerCase() === name.toLowerCase()
          );
          
          if (nameExists) {
            ws.send(JSON.stringify({ type: 'name_taken' }));
            return;
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

console.log('WebSocket сервер запущен на ws://localhost:8080');

