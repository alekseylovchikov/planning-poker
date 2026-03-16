import styles from './SoundButton.module.scss';

type SoundButtonProps = {
    isMuted: boolean;
    onClick: () => void;
}

export function SoundButton({ isMuted, onClick }: SoundButtonProps) {
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
