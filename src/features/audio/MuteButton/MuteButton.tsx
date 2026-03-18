import styles from './MuteButton.module.scss';

type MuteButtonProps = {
  isMuted: boolean;
  onClick: () => void;
};

export function MuteButton({ isMuted, onClick }: MuteButtonProps) {
  return (
    <button
      className={styles.muteButton}
      onClick={onClick}
      title={isMuted ? 'Включить звук' : 'Выключить звук'}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>
  );
}
