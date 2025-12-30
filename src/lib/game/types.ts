export type GamePhase = "lobby" | "question" | "reveal" | "finished";

export interface Player {
  token: string; // Persistent ID (UUID or User ID)
  socketId: string; // Current Socket ID
  name: string;
  avatar: string;
  score: number;
  connected: boolean;
  lastSeen: number;

  // Jokers
  joker5050: boolean;
  jokerSpy: boolean; // Note: Spy might be restricted in single-player or adapted
  jokerRisk: boolean;

  // Round specific
  selectedChoice: number | null; // 0-3
  usedRiskThisQ: boolean;
  usedSpyThisQ: boolean;
  used5050ThisQ: boolean;
}

export interface QuestionPayload {
  text: string;
  choices: string[];
  // correctIndex is NOT sent to client usually, but needed for reveal
}

export interface RoomState {
  code: string;
  hostToken: string;
  createdAt: number;
  lastActivity: number;
  players: Record<string, Player>;

  phase: GamePhase;
  questionIndex: number;
  questionOrder: number[]; // Indices of questions? Or IDs? IDs better if DB backed.

  currentQ: QuestionPayload | null;
  correctIndex: number | null; // Server side only

  qDeadlineTs: number | null;
  revealDeadlineTs?: number | null; // For reveal phase timer
  paused?: boolean;
  pauseRemaining?: number; // ms remaining when paused

  jokerUsedThisQ: boolean;
  livePicks: Record<string, number | null>;

  questionClosed: boolean;
  revealData: {
    correctIndex: number;
    picksByChoice: Record<
      number,
      { name: string; avatar: string; token: string }[]
    >;
    pointsForThisRound?: number;
  } | null;

  settings: {
    simultaneousJokers: boolean;
  };

  config?: GameConfig;
}

export type RatioStrategy = "by_collection" | "consistent" | "custom";

export interface GameConfig {
  collectionIds: string[];
  totalQuestions: number;
  ratioStrategy: RatioStrategy;
  customRatios?: Record<string, number>; // collectionId -> count
}
