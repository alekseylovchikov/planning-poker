import { useEffect, useRef } from "react";
import type { Participant } from "../types";

interface UseRevealEffectsOptions {
  votesRevealed: boolean;
  participants: Participant[];
  isMuted: boolean;
  playAudio: (allEqual: boolean) => void;
  roomId: string | undefined;
}

export function useRevealEffects({
  votesRevealed,
  participants,
  isMuted,
  playAudio,
  roomId,
}: UseRevealEffectsOptions) {
  const prevVotesRevealedRef = useRef(votesRevealed);
  const originalTitleRef = useRef<string | null>(null);
  const titleIntervalRef = useRef<number | null>(null);
  const hasRequestedNotificationRef = useRef(false);

  const clearTitleAttention = () => {
    if (titleIntervalRef.current !== null) {
      window.clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (typeof document !== "undefined" && originalTitleRef.current !== null) {
      document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!roomId || hasRequestedNotificationRef.current) return;
    hasRequestedNotificationRef.current = true;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const prev = prevVotesRevealedRef.current;
    const current = votesRevealed;
    prevVotesRevealedRef.current = current;

    if (!prev && !current) {
      clearTitleAttention();
      return;
    }

    if (!prev && current) {
      const validVotes = participants
        .filter((p) => p.hasVoted && p.vote)
        .map((p) => p.vote);

      if (validVotes.length > 0) {
        const allEqual = validVotes.every((v) => v === validVotes[0]);
        if (!isMuted) playAudio(allEqual);
      }

      if (typeof document !== "undefined") {
        if (originalTitleRef.current === null) {
          originalTitleRef.current = document.title;
        }
        clearTitleAttention();
        titleIntervalRef.current = window.setInterval(() => {
          document.title = originalTitleRef.current || "Planning Poker";
        }, 1000);

        const handleVisibilityChange = () => {
          if (!document.hidden) {
            clearTitleAttention();
            document.removeEventListener(
              "visibilitychange",
              handleVisibilityChange,
            );
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
      }

      const show = () => {
        const n = new Notification("Planning Poker", {
          body: "Карты открыты!",
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      };

      if (Notification.permission === "granted") {
        show();
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((p) => {
          if (p === "granted") show();
        });
      }
    }
  }, [votesRevealed, participants, isMuted, playAudio]);
}
