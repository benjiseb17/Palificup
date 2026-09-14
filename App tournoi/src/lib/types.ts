export type Player = {
  id: string;
  name: string;
  team: string;
  seed: string;
};

export type Bracket = "POULE" | "A" | "B" | "FINAL";

export type RoundRow = {
  round_id: string;
  bracket: Bracket;
  stage: string;
  table_number: string;
  status: "open" | "closed";
};

export type SeatRow = {
  round_id: string;
  player_id: string;
  from_round_id: string;
  from_rank: string;
  finish_rank: string;
};

export type TournamentStatus = "setup" | "running" | "finished";
