import { toast } from 'react-toastify';
import type { GameState } from '../types';
import { MuteButton } from '../features/audio/MuteButton';
import styles from './Header.module.scss';

interface HeaderProps {
  gameState: GameState;
  isConnected: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function Header({
  gameState,
  isConnected,
  isMuted,
  onMuteToggle,
}: HeaderProps) {
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Ссылка скопирована!');
  };

  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Planning Poker</h1>

      <div className={styles.connectionStatus}>
        {gameState.roomId && (
          <span className={styles.roomId} onClick={handleCopyLink}>
            Комната: {gameState.roomId} (скопировать)
          </span>
        )}

        <a className={styles.createNewRoomLink} href={window.location.origin}>
          Создать новую комнату
        </a>

        <a
          className={styles.buyMeCoffeeLink}
          href="https://buymeacoffee.com/jwebbb"
          target="_blank"
          rel="noopener noreferrer"
        >
          Buy Me a Coffee
        </a>

        <div className={styles.connectionStatusContainer}>
          <MuteButton isMuted={isMuted} onClick={onMuteToggle} />

          <span
            className={`${styles.statusIndicator} ${
              isConnected ? styles.connected : styles.disconnected
            }`}
          />
          <span>{isConnected ? 'Подключено' : 'Подключение...'}</span>
        </div>
      </div>
    </div>
  );
}
