import type { Participant, VoteValue } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import styles from "./VotingTable.module.scss";

interface VotingTableProps {
  participants: Participant[];
  votesRevealed: boolean;
  onReset: () => void;
  onReveal: () => void;
}

const voteToNumber = (vote: VoteValue | undefined): number | null => {
  if (!vote || vote === "???") return null;
  return parseFloat(vote);
};

export const VotingTable = ({
  participants,
  votesRevealed,
  onReset,
  onReveal,
}: VotingTableProps) => {
  const votedParticipants = participants.filter((p) => p.hasVoted);
  const hasVotes = votedParticipants.length > 0;

  // Вычисляем минимальные и максимальные значения голосов
  const voteNumbers = votedParticipants
    .map((p) => voteToNumber(p.vote))
    .filter((num): num is number => num !== null);

  const minVote = voteNumbers.length > 0 ? Math.min(...voteNumbers) : null;
  const maxVote = voteNumbers.length > 0 ? Math.max(...voteNumbers) : null;

  // Проверяем, является ли голос минимальным или максимальным
  const isMinOrMax = (vote: VoteValue | undefined): boolean => {
    if (!votesRevealed || !vote || vote === "???") return false;
    const num = voteToNumber(vote);
    if (num === null) return false;
    return num === minVote || num === maxVote;
  };

  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle>Таблица голосования</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.content}>
          {!hasVotes ? (
            <p className={styles.empty}>Пока никто не проголосовал</p>
          ) : (
            <div className={styles.table}>
              {votedParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className={`${styles.voteCard} ${
                    votesRevealed ? styles.revealed : styles.hidden
                  } ${isMinOrMax(participant.vote) ? styles.highlight : ""}`}
                >
                  <div className={styles.participantName}>
                    {participant.name}
                  </div>
                  <div className={styles.voteValue}>
                    {votesRevealed ? participant.vote || "—" : "?"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <Button
              onClick={onReset}
              variant="outline"
              className={styles.button}
            >
              Сбросить
            </Button>
            <Button
              onClick={onReveal}
              variant="outline"
              disabled={!hasVotes || votesRevealed}
              className={styles.button}
            >
              {votesRevealed ? "Карты открыты" : "Открыть карты"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
