export type VoteValue = "0.5" | "1" | "2" | "3" | "5" | "8" | "13" | "???";

export interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
  vote?: VoteValue;
  hasVoted: boolean;
  canControlVotes?: boolean;
}

export interface GameState {
  roomId?: string;
  participants: Participant[];
  votesRevealed: boolean;
  currentVotes: Record<string, VoteValue>;
  isCreator?: boolean;
   canControlVotes?: boolean;
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
    | "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}
