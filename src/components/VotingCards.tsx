import type { VoteValue } from "../types";
import { Button } from "./ui/button";
import styles from "./VotingCards.module.scss";

interface VotingCardsProps {
  selectedVote: VoteValue | null;
  onSelectVote: (vote: VoteValue) => void;
  onVote: () => void;
  hasVoted: boolean;
  votesRevealed: boolean;
}

const VOTE_VALUES: VoteValue[] = ["0.5", "1", "2", "3", "5", "8", "13", "???"];

export const VotingCards = ({
  selectedVote,
  onSelectVote,
  onVote,
  hasVoted,
  votesRevealed,
}: VotingCardsProps) => {
  const isVotingDisabled = hasVoted || votesRevealed;

  return (
    <div className={styles.container}>
      <div className={styles.cardGrid}>
        {VOTE_VALUES.map((value) => (
          <button
            key={value}
            className={`${styles.card} ${
              selectedVote === value ? styles.selected : ""
            } ${isVotingDisabled ? styles.disabled : ""}`}
            onClick={() => !isVotingDisabled && onSelectVote(value)}
            disabled={isVotingDisabled}
          >
            {value}
          </button>
        ))}
      </div>

      <Button
        onClick={onVote}
        disabled={!selectedVote || isVotingDisabled}
        className={styles.voteButton}
        size="lg"
      >
        {votesRevealed
          ? "Карты уже открыты"
          : hasVoted
          ? "Вы уже проголосовали"
          : "Проголосовать"}
      </Button>
    </div>
  );
};
