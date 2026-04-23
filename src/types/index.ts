export type VoteValue = "0.5" | "1" | "2" | "3" | "5" | "8" | "13" | "???";

export interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
  vote?: VoteValue;
  hasVoted: boolean;
  canControlVotes?: boolean;
}

export interface Task {
  taskId: string;
  name: string;
  url: string;
  description?: string;
  createdAt?: string;
}

export interface GameState {
  roomId?: string;
  participants: Participant[];
  votesRevealed: boolean;
  currentVotes: Record<string, VoteValue>;
  isCreator?: boolean;
  canControlVotes?: boolean;
  tasks?: Task[];
}

export interface WebSocketMessage {
  type:
    | "join"
    | "leave"
    | "vote"
    | "reset"
    | "reveal"
    | "state"
    | "name_taken"
    | "set_controller"
    | "add_task"
    | "remove_task"
    | "update_task"
    | "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}
