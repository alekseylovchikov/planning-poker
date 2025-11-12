import type { Participant } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import styles from "./ParticipantsList.module.scss";

interface ParticipantsListProps {
  participants: Participant[];
  currentUserName?: string;
}

export const ParticipantsList = ({
  participants,
  currentUserName,
}: ParticipantsListProps) => {
  return (
    <Card className={styles.card}>
      <CardHeader>
        <CardTitle>Участники ({participants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.list}>
          {participants.length === 0 ? (
            <p className={styles.empty}>Нет участников</p>
          ) : (
            participants.map((participant) => (
              <div
                key={participant.id}
                className={`${styles.participant} ${
                  participant.name === currentUserName ? styles.current : ""
                }`}
              >
                <div className={styles.info}>
                  <span className={styles.name}>{participant.name}</span>
                  {participant.name === currentUserName && (
                    <span className={styles.you}>(Вы)</span>
                  )}
                </div>
                <div className={styles.status}>
                  <span
                    className={`${styles.indicator} ${
                      participant.isOnline ? styles.online : styles.offline
                    }`}
                  />
                  <span className={styles.statusText}>
                    {participant.isOnline ? "Онлайн" : "Офлайн"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

