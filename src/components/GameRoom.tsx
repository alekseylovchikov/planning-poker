import { ParticipantsList } from "./ParticipantsList";
import { VotingCards } from "./VotingCards";
import { VotingTable } from "./VotingTable";
import { TasksList } from "./TasksList";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { GameState, Participant, VoteValue } from "../types";
import styles from "./GameRoom.module.scss";

interface GameRoomProps {
  gameState: GameState;
  userName: string;
  selectedVote: VoteValue | null;
  onSelectVote: (vote: VoteValue | null) => void;
  onVote: () => void;
  currentParticipant: Participant | undefined;
  onReset: () => void;
  onReveal: () => void;
  onSetController: (participantId: string, canControl: boolean) => void;
  onAddTask: (name: string, url: string, description?: string) => void;
  onRemoveTask: (taskId: string) => void;
  onUpdateTask: (
    taskId: string,
    updates: { name?: string; url?: string; description?: string },
  ) => void;
}

export function GameRoom({
  gameState,
  userName,
  selectedVote,
  onSelectVote,
  onVote,
  currentParticipant,
  onReset,
  onReveal,
  onSetController,
  onAddTask,
  onRemoveTask,
  onUpdateTask,
}: GameRoomProps) {
  return (
    <div className={styles.content}>
      <div className={styles.sidebar}>
        <ParticipantsList
          participants={gameState.participants}
          currentUserName={userName}
          isCreator={gameState.isCreator || false}
          onToggleController={onSetController}
        />
      </div>

      <div className={styles.main}>
        <Card>
          <CardHeader>
            <CardTitle>Оценки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.votingSection}>
              <VotingCards
                selectedVote={selectedVote}
                onSelectVote={onSelectVote}
                onVote={onVote}
                hasVoted={currentParticipant?.hasVoted || false}
                votesRevealed={gameState.votesRevealed}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Задачи</CardTitle>
          </CardHeader>
          <CardContent>
            <TasksList
              tasks={gameState.tasks || []}
              isCreator={gameState.isCreator || false}
              onAddTask={onAddTask}
              onRemoveTask={onRemoveTask}
              onUpdateTask={onUpdateTask}
            />
          </CardContent>
        </Card>

        <div className={styles.tableSection}>
          <VotingTable
            participants={gameState.participants}
            votesRevealed={gameState.votesRevealed}
            onReset={onReset}
            onReveal={onReveal}
            canControlVotes={gameState.canControlVotes || false}
          />
        </div>
      </div>
    </div>
  );
}
