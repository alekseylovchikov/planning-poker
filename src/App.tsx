import { useState, useEffect } from "react";
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
    if (envUrl.startsWith('ws://') || envUrl.startsWith('wss://')) {
      return envUrl;
    }
    // Если URL без протокола, определяем автоматически
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${envUrl}`;
  }
  // Для разработки используем ws://localhost
  return window.location.protocol === 'https:' 
    ? "wss://localhost:8080" 
    : "ws://localhost:8080";
};

const WS_URL = getWebSocketUrl();

function App() {
  const [userName, setUserName] = useState<string | null>(
    localStorage.getItem("userName")
  );
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const { isConnected, gameState, error, join, vote, reset, reveal, setOnNameTaken } =
    useWebSocket(WS_URL);

  useEffect(() => {
    setOnNameTaken(() => {
      setUserName(null);
      localStorage.removeItem("userName");
      setIsJoining(false);
    });
  }, [setOnNameTaken]);

  useEffect(() => {
    if (userName && isConnected && !isJoining) {
      setIsJoining(true);
      join(userName);
    }
  }, [userName, isConnected, join, isJoining]);

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

  // Сбрасываем выбранный голос, когда голосование сброшено
  useEffect(() => {
    if (currentParticipant && !currentParticipant.hasVoted) {
      setSelectedVote(null);
    }
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
