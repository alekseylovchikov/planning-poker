import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { NameInput } from "./components/NameInput";
import { ParticipantsList } from "./components/ParticipantsList";
import { VotingCards } from "./components/VotingCards";
import { VotingTable } from "./components/VotingTable";
import { useWebSocket } from "./hooks/useWebSocket";
import { sanitizeName } from "./lib/utils";
import type { VoteValue } from "./types";
import styles from "./App.module.scss";

// WebSocket URL - автоматически определяет протокол (ws/wss) на основе текущего протокола страницы
const getWebSocketUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) {
    // Если URL начинается с ws:// или wss://, используем как есть
    if (envUrl.startsWith("ws://") || envUrl.startsWith("wss://")) {
      return envUrl;
    }
    // Если URL без протокола, определяем автоматически
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${envUrl}`;
  }

  // Автоматическое определение на основе текущего домена (для Railway и других платформ)
  // Если приложение работает на продакшене, используем тот же домен для WebSocket
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost) {
    // Для разработки используем ws://localhost
    return window.location.protocol === "https:"
      ? "wss://localhost:8080"
      : "ws://localhost:8080";
  }

  // Для продакшена используем тот же домен и порт (Railway обычно использует тот же домен)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = window.location.port ? `:${window.location.port}` : "";
  return `${protocol}//${hostname}${port}`;
};

const WS_URL = getWebSocketUrl();

function App() {
  // Санитизируем имя при загрузке из localStorage
  const storedName = localStorage.getItem("userName");
  const [userName, setUserName] = useState<string | null>(
    storedName ? sanitizeName(storedName) : null
  );
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("room");
    }
    return null;
  });
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const hasAttemptedJoinRef = useRef(false);

  const {
    isConnected,
    gameState,
    error,
    join,
    vote,
    reset,
    reveal,
    setOnNameTaken,
  } = useWebSocket(WS_URL);

  // Обновляем URL когда получаем roomId от сервера
  useEffect(() => {
    if (gameState.roomId && gameState.roomId !== roomId) {
      setRoomId(gameState.roomId);
      const params = new URLSearchParams(window.location.search);
      params.set("room", gameState.roomId);
      window.history.pushState({}, "", `?${params.toString()}`);
    }
  }, [gameState.roomId, roomId]);

  useEffect(() => {
    setOnNameTaken(() => {
      setUserName(null);
      localStorage.removeItem("userName");
      setIsJoining(false);
      hasAttemptedJoinRef.current = false;
    });
  }, [setOnNameTaken]);

  // Автоматическое присоединение при подключении или переподключении
  useEffect(() => {
    if (userName && isConnected && !hasAttemptedJoinRef.current) {
      hasAttemptedJoinRef.current = true;
      setTimeout(() => {
        setIsJoining(true);
        join(userName, roomId || undefined);
      }, 0);
    }
  }, [userName, isConnected, join, roomId]);

  // Сбрасываем флаг присоединения при отключении для возможности переподключения
  useEffect(() => {
    if (!isConnected) {
      hasAttemptedJoinRef.current = false;
      setTimeout(() => {
        setIsJoining(false);
      }, 0);
    }
  }, [isConnected]);

  const handleNameSubmit = (name: string) => {
    // Имя уже санитизировано в NameInput, но санитизируем еще раз для безопасности
    const sanitizedName = sanitizeName(name);
    setUserName(sanitizedName);
    localStorage.setItem("userName", sanitizedName);
    setIsJoining(true);
    if (isConnected) {
      join(sanitizedName, roomId || undefined);
    }
  };

  const handleVote = () => {
    if (selectedVote) {
      vote(selectedVote);
      setSelectedVote(null);
    }
  };

  // Сравниваем санитизированные имена для поиска текущего участника
  const sanitizedUserName = userName ? sanitizeName(userName) : null;
  const currentParticipant = gameState.participants.find(
    (p) => sanitizeName(p.name) === sanitizedUserName
  );

  // Сбрасываем выбранный голос только когда голосование действительно сброшено на сервере
  // Отслеживаем изменение hasVoted с true на false - это означает reset
  const prevHasVotedRef = useRef(currentParticipant?.hasVoted ?? false);
  useEffect(() => {
    const currentHasVoted = currentParticipant?.hasVoted ?? false;
    // Если hasVoted изменился с true на false - произошел reset, сбрасываем выбранную карту
    if (prevHasVotedRef.current === true && currentHasVoted === false) {
      setSelectedVote(null);
    }
    prevHasVotedRef.current = currentHasVoted;
  }, [currentParticipant?.hasVoted]);

  // Эффект для запуска фейерверка при совпадении всех оценок
  const hasFiredFireworksRef = useRef(false);

  useEffect(() => {
    if (!gameState.votesRevealed) {
      hasFiredFireworksRef.current = false;
      return;
    }

    if (gameState.votesRevealed && !hasFiredFireworksRef.current) {
      // Получаем голоса только тех, кто проголосовал
      const validVotes = gameState.participants
        .filter((p) => p.hasVoted && p.vote)
        .map((p) => p.vote);

      if (validVotes.length > 0) {
        const firstVote = validVotes[0];
        const allEqual = validVotes.every((v) => v === firstVote);

        if (allEqual) {
          hasFiredFireworksRef.current = true;

          // Запускаем фейерверк
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 50, // Увеличиваем z-index чтобы было видно поверх интерфейса
          };

          const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
          };

          const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // since particles fall down, start a bit higher than random
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
          }, 250);
        }
      }
    }
  }, [gameState.votesRevealed, gameState.participants]);

  // Если пользователь не ввел имя, показываем форму ввода
  if (!userName) {
    return (
      <NameInput
        onSubmit={handleNameSubmit}
        error={error}
        isLoading={isJoining}
      />
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <h1 className={styles.title}>Planning Poker</h1>
        <div className={styles.connectionStatus}>
          {gameState.roomId && (
            <span
              className={styles.roomId}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Ссылка скопирована!");
              }}
              style={{ cursor: "pointer", marginRight: "10px" }}
            >
              Комната: {gameState.roomId} (нажми чтобы скопировать)
            </span>
          )}
          <span
            className={`${styles.statusIndicator} ${
              isConnected ? styles.connected : styles.disconnected
            }`}
          />
          <span>{isConnected ? "Подключено" : "Подключение..."}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <ParticipantsList
            participants={gameState.participants}
            currentUserName={userName}
          />
        </div>

        <div className={styles.main}>
          <div className={styles.votingSection}>
            <VotingCards
              selectedVote={selectedVote}
              onSelectVote={setSelectedVote}
              onVote={handleVote}
              hasVoted={currentParticipant?.hasVoted || false}
              votesRevealed={gameState.votesRevealed}
            />
          </div>

          <div className={styles.tableSection}>
            <VotingTable
              participants={gameState.participants}
              votesRevealed={gameState.votesRevealed}
              onReset={reset}
              onReveal={reveal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
