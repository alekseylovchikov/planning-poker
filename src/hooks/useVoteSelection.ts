import { useState, useEffect, useRef, useCallback } from "react";
import type { VoteValue } from "../types";

interface UseVoteSelectionOptions {
  vote: (value: VoteValue) => void;
  hasVoted: boolean;
}

export function useVoteSelection({ vote, hasVoted }: UseVoteSelectionOptions) {
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const prevHasVotedRef = useRef(hasVoted);

  useEffect(() => {
    if (prevHasVotedRef.current === true && hasVoted === false) {
      setTimeout(() => setSelectedVote(null), 0);
    }
    prevHasVotedRef.current = hasVoted;
  }, [hasVoted]);

  const handleVote = useCallback(() => {
    if (selectedVote) {
      vote(selectedVote);
      setSelectedVote(null);
    }
  }, [selectedVote, vote]);

  return { selectedVote, setSelectedVote, handleVote } as const;
}
