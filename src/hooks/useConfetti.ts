import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { Participant } from "../types";

export function useConfetti(
  votesRevealed: boolean,
  participants: Participant[],
) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!votesRevealed) {
      hasFiredRef.current = false;
      return;
    }

    if (hasFiredRef.current) return;

    const validVotes = participants
      .filter((p) => p.hasVoted && p.vote)
      .map((p) => p.vote);

    if (validVotes.length === 0) return;

    const allEqual = validVotes.every((v) => v === validVotes[0]);
    if (!allEqual) return;

    hasFiredRef.current = true;

    const duration = 3_000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 50 * (timeLeft / duration);
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

    return () => clearInterval(interval);
  }, [votesRevealed, participants]);
}
