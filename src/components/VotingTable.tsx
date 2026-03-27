import type { Participant, VoteValue } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { truncateName, sanitizeName } from '../lib';
import styles from './VotingTable.module.scss';
import { useMemo } from 'react';

interface VotingTableProps {
  participants: Participant[];
  votesRevealed: boolean;
  onReset: () => void;
  onReveal: () => void;
  canControlVotes: boolean;
}

const voteToNumber = (vote: VoteValue | undefined): number | null => {
  if (!vote || vote === '???') return null;

  return parseFloat(vote);
};

export const VotingTable = ({
  participants,
  votesRevealed,
  onReset,
  onReveal,
  canControlVotes,
}: VotingTableProps) => {
  const votedParticipants = useMemo(
    () => participants.filter((p) => p.hasVoted),
    [participants],
  );
  const hasVotes = votedParticipants.length > 0;

  // Вычисляем минимальные и максимальные значения голосов
  const voteNumbers = votedParticipants
    .map((p) => voteToNumber(p.vote))
    .filter((num): num is number => num !== null);

  const minVote = voteNumbers.length > 0 ? Math.min(...voteNumbers) : null;
  const maxVote = voteNumbers.length > 0 ? Math.max(...voteNumbers) : null;
  const hasDifferentVotes =
    minVote !== null && maxVote !== null && minVote !== maxVote;

  // Проверяем, является ли голос минимальным или максимальным
  // Подсвечиваем только если есть разные оценки
  const isMinOrMax = (vote: VoteValue | undefined): boolean => {
    if (!votesRevealed || !vote || vote === '???' || !hasDifferentVotes)
      return false;
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
            <p className={styles.empty}>Никто не проголосовал</p>
          ) : (
            <div className={styles.table}>
              {votedParticipants
                .sort(({ vote: aVote }, { vote: bVote }) => {
                  const aNum = voteToNumber(aVote);
                  const bNum = voteToNumber(bVote);

                  if (aNum === null && bNum === null) return 0;
                  if (aNum === null) return 1;
                  if (bNum === null) return -1;

                  return aNum - bNum;
                })
                .map((participant) => {
                  const sanitizedName = sanitizeName(participant.name);
                  const displayName = truncateName(sanitizedName, 15);

                  return (
                    <div
                      key={participant.id}
                      className={`${styles.voteCard} ${
                        votesRevealed ? styles.revealed : styles.hidden
                      } ${isMinOrMax(participant.vote) ? styles.highlight : ''}`}
                      title={
                        sanitizedName !== displayName
                          ? sanitizedName
                          : undefined
                      }
                    >
                      <div className={styles.participantName}>
                        {displayName}
                      </div>
                      <div className={styles.voteValue}>
                        {votesRevealed ? participant.vote || '—' : '?'}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {canControlVotes && (
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
                {votesRevealed ? 'Карты открыты' : 'Открыть карты'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
