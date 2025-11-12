import { useState, useEffect } from "react";
import { NameInput } from "./components/NameInput";
import { ParticipantsList } from "./components/ParticipantsList";
import { VotingCards } from "./components/VotingCards";
import { VotingTable } from "./components/VotingTable";
import { useWebSocket } from "./hooks/useWebSocket";
import type { VoteValue } from "./types";
import styles from "./App.module.scss";

// Mock WebSocket URL - в реальном приложении это будет URL вашего сервера
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

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
