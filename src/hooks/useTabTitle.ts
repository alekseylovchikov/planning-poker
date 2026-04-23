import { useEffect } from "react";
import type { Participant } from "../types";

export function useTabTitle(
  participants: Participant[],
  votesRevealed: boolean,
) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (votesRevealed) return;

    const votedCount = participants.filter((p) => p.hasVoted && p.vote).length;
    document.title =
      votedCount > 0 ? `${votedCount} – Planning Poker` : "Planning Poker";
  }, [participants, votesRevealed]);
}
