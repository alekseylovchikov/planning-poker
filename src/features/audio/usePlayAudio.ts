import { useCallback } from "react";

export function useAudio() {
  const playAudio = useCallback((allEqual: boolean) => {
    const soundPath = allEqual ? '/sounds/wow.mp3' : '/sounds/error.mp3';
    const audio = new Audio(soundPath);

    audio.volume = 0.6;

    void audio.play().catch(() => {
      // Игнорируем ошибки воспроизведения (например, ограничения автоплея)
    });
  }, []);

  return {
    playAudio,
  };
}
