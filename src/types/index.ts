export type VoteValue = "0.5" | "1" | "2" | "3" | "5" | "8" | "13" | "???";

export interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
  vote?: VoteValue;
  hasVoted: boolean;
}

export interface GameState {
  participants: Participant[];
  votesRevealed: boolean;
  currentVotes: Record<string, VoteValue>;
}

export interface WebSocketMessage {
  type: "join" | "leave" | "vote" | "reset" | "reveal" | "state" | "name_taken";
  payload?: any;
}

