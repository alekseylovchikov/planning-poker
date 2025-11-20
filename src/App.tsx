import { useState, useEffect, useRef } from "react";
import { NameInput } from "./components/NameInput";
import { ParticipantsList } from "./components/ParticipantsList";
import { VotingCards } from "./components/VotingCards";
import { VotingTable } from "./components/VotingTable";
import { useWebSocket } from "./hooks/useWebSocket";
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
  const [userName, setUserName] = useState<string | null>(
    localStorage.getItem("userName")
  );
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
        join(userName);
      }, 0);
    }
  }, [userName, isConnected, join]);

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
    setUserName(name);
    localStorage.setItem("userName", name);
    setIsJoining(true);
    if (isConnected) {
      join(name);
    }
  };

  const handleVote = () => {
    if (selectedVote) {
      vote(selectedVote);
      setSelectedVote(null);
    }
  };

  const currentParticipant = gameState.participants.find(
    (p) => p.name === userName
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
