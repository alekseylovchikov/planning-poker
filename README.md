# Planning Poker Application

Приложение для планирования задач (Planning Poker) с использованием WebSocket для синхронизации в реальном времени.

## Технологический стек

- **React.js** - библиотека для создания пользовательского интерфейса
- **TypeScript** - типизированный JavaScript
- **Vite** - сборщик и dev-сервер
- **SCSS модули** - стилизация компонентов
- **shadcn/ui** - UI компоненты
- **WebSocket** - для синхронизации в реальном времени

## Функциональность

- ✅ Ввод уникального имени пользователя
- ✅ Список участников с отображением онлайн/офлайн статуса
- ✅ Карточки для голосования (числа Фибоначчи: 1, 2, 3, 5, 8, 13)
- ✅ Дополнительные оценки: 0.5 и ???
- ✅ Голосование и отображение результатов на столе
- ✅ Кнопки сброса и открытия карт
- ✅ Синхронизация в реальном времени через WebSocket

## Установка и запуск

1. Установите зависимости:
```bash
npm install
```

2. Запустите WebSocket сервер (в отдельном терминале):
```bash
# Установите ws для примера сервера (если еще не установлен)
npm install ws

# Запустите пример сервера
node server-example.js
```

3. Запустите dev-сервер клиента:
```bash
npm run dev
```

4. Откройте браузер по адресу, указанному в консоли (обычно http://localhost:5173)

## Настройка WebSocket сервера

Приложение ожидает WebSocket сервер на `ws://localhost:8080` по умолчанию.

Вы можете изменить URL через переменную окружения:
```bash
VITE_WS_URL=ws://your-server:port npm run dev
```

### Формат сообщений WebSocket

#### Клиент → Сервер:

```typescript
// Присоединение к комнате
{ type: "join", payload: { name: string } }

// Голосование
{ type: "vote", payload: { vote: VoteValue } }

// Сброс голосов
{ type: "reset" }

// Открытие карт
{ type: "reveal" }
```

#### Сервер → Клиент:

```typescript
// Обновление состояния игры
{ type: "state", payload: GameState }

// Имя уже занято
{ type: "name_taken" }
```

### Структура GameState:

```typescript
interface GameState {
  participants: Participant[];
  votesRevealed: boolean;
  currentVotes: Record<string, VoteValue>;
}

interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
  vote?: VoteValue;
  hasVoted: boolean;
}

type VoteValue = "0.5" | "1" | "2" | "3" | "5" | "8" | "13" | "???";
```

## Структура проекта

```
src/
├── components/          # React компоненты
│   ├── ui/             # UI компоненты (shadcn/ui)
│   ├── NameInput.tsx   # Компонент ввода имени
│   ├── ParticipantsList.tsx  # Список участников
│   ├── VotingCards.tsx       # Карточки для голосования
│   └── VotingTable.tsx       # Таблица с результатами
├── hooks/
│   └── useWebSocket.ts       # Хук для работы с WebSocket
├── types/
│   └── index.ts              # TypeScript типы
├── lib/
│   └── utils.ts              # Утилиты
└── App.tsx                   # Главный компонент
```

## Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в папке `dist/`.

## Примечания

- Имя пользователя сохраняется в localStorage
- Приложение автоматически переподключается при потере соединения
- Все участники видят результаты голосования в реальном времени
