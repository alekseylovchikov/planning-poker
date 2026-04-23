import { NameInput } from "./components/NameInput";
import { Header } from "./components/Header";
import { GameRoom } from "./components/GameRoom";
import { ThemeToggleButton } from "./components/ThemeToggleButton";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { useMute } from "./hooks/useMute";
import { useRoom } from "./hooks/useRoom";
import { useAutoJoin } from "./hooks/useAutoJoin";
import { useVoteSelection } from "./hooks/useVoteSelection";
import { useConfetti } from "./hooks/useConfetti";
import { useTabTitle } from "./hooks/useTabTitle";
import { useRevealEffects } from "./hooks/useRevealEffects";
import { useAudio } from "./features/audio/usePlayAudio";
import { sanitizeName, getWebSocketUrl } from "./lib";
import { ToastContainer } from "react-toastify";
import styles from "./App.module.scss";

const WS_URL = getWebSocketUrl();

function App() {
  const { theme, toggleTheme } = useTheme();
  const { isMuted, toggleMute } = useMute();
  const { playAudio } = useAudio();

  const {
    isConnected,
    gameState,
    error,
    join,
    vote,
    reset,
    reveal,
    setOnNameTaken,
    setParticipantCanControl,
    addTask,
    removeTask,
    updateTask,
  } = useWebSocket(WS_URL);

  const { roomId } = useRoom(gameState.roomId);

  const { userName, isJoining, handleNameSubmit } = useAutoJoin({
    isConnected,
    join,
    setOnNameTaken,
    roomId,
  });

  const sanitizedUserName = userName ? sanitizeName(userName) : null;
  const currentParticipant = gameState.participants.find(
    (p) => sanitizeName(p.name) === sanitizedUserName,
  );

  const { selectedVote, setSelectedVote, handleVote } = useVoteSelection({
    vote,
    hasVoted: currentParticipant?.hasVoted ?? false,
  });

  useConfetti(gameState.votesRevealed, gameState.participants);
  useTabTitle(gameState.participants, gameState.votesRevealed);
  useRevealEffects({
    votesRevealed: gameState.votesRevealed,
    participants: gameState.participants,
    isMuted,
    playAudio,
    roomId: gameState.roomId,
  });

  if (!userName) {
    return (
      <>
        <NameInput
          onSubmit={handleNameSubmit}
          error={error}
          isLoading={isJoining}
        />
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
      </>
    );
  }

  return (
    <div className={styles.app}>
      <Header
        gameState={gameState}
        isConnected={isConnected}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />

      <GameRoom
        gameState={gameState}
        userName={userName}
        selectedVote={selectedVote}
        onSelectVote={setSelectedVote}
        onVote={handleVote}
        currentParticipant={currentParticipant}
        onReset={reset}
        onReveal={reveal}
        onSetController={setParticipantCanControl}
        onAddTask={addTask}
        onRemoveTask={removeTask}
        onUpdateTask={updateTask}
      />

      <ToastContainer />
      <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
    </div>
  );
}

export default App;
