import type { Participant } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import styles from "./VotingTable.module.scss";

interface VotingTableProps {
  participants: Participant[];
  votesRevealed: boolean;
  onReset: () => void;
  onReveal: () => void;
}

export const VotingTable = ({
  participants,
  votesRevealed,
  onReset,
  onReveal,
}: VotingTableProps) => {
  const votedParticipants = participants.filter((p) => p.hasVoted);
  const hasVotes = votedParticipants.length > 0;

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
                  }`}
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
