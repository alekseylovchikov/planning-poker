import type { VoteValue } from "../types";
import { Button } from "./ui/button";
import styles from "./VotingCards.module.scss";

interface VotingCardsProps {
  selectedVote: VoteValue | null;
  onSelectVote: (vote: VoteValue) => void;
  onVote: () => void;
  hasVoted: boolean;
}

const VOTE_VALUES: VoteValue[] = ["0.5", "1", "2", "3", "5", "8", "13", "???"];

export const VotingCards = ({
  selectedVote,
  onSelectVote,
  onVote,
  hasVoted,
}: VotingCardsProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.cardGrid}>
        {VOTE_VALUES.map((value) => (
          <button
            key={value}
            className={`${styles.card} ${
              selectedVote === value ? styles.selected : ""
            } ${hasVoted ? styles.disabled : ""}`}
            onClick={() => !hasVoted && onSelectVote(value)}
            disabled={hasVoted}
          >
            {value}
          </button>
        ))}
      </div>
      
      <Button
        onClick={onVote}
        disabled={!selectedVote || hasVoted}
        className={styles.voteButton}
        size="lg"
      >
        {hasVoted ? "Вы уже проголосовали" : "Проголосовать"}
      </Button>
    </div>
  );
};

