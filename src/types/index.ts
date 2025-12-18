// Core coordinate type used throughout the system
export interface Coordinate {
  x: number;
  y: number;
}

// Individual cell on the game board
export interface Cell {
  hasMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
  coordinates: Coordinate;
}

// Difficulty configuration for game generation
export interface DifficultySettings {
  width: number;
  height: number;
  mineCount: number;
  name: string;
}

// Main game state interface
export interface GameState {
  board: Cell[][];
  gameStatus: 'playing' | 'won' | 'lost';
  startTime: Date;
  flagCount: number;
  revealedCount: number;
  difficulty: DifficultySettings;
}

// AI hint analysis results
export interface HintAnalysis {
  guaranteedSafe: Coordinate[];
  guaranteedMines: Coordinate[];
  probabilities: Map<Coordinate, number>;
  recommendedMove: Coordinate | null;
  confidence: number;
}

// Constraint for AI analysis
export interface Constraint {
  centerCell: Coordinate;
  requiredMines: number;
  affectedCells: Coordinate[];
}

// Player performance tracking
export interface PlayerPerformance {
  gamesPlayed: number;
  winRate: number;
  averageTime: number;
  hintUsageRate: number;
  difficultyProgression: DifficultyLevel[];
  recentTrends: PerformanceTrend[];
}

// Individual game result for statistics
export interface GameResult {
  success: boolean;
  duration: number;
  hintsUsed: number;
  difficulty: DifficultySettings;
  timestamp: Date;
}

// Difficulty level enumeration
export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERT = 'expert',
  CUSTOM = 'custom'
}

// Performance trend data
export interface PerformanceTrend {
  period: string;
  winRate: number;
  averageTime: number;
  gamesPlayed: number;
}

// Click type for cell interactions
export enum ClickType {
  LEFT = 'left',
  RIGHT = 'right',
  MIDDLE = 'middle'
}

// Animation state for UI effects
export interface AnimationState {
  isAnimating: boolean;
  animationType: 'reveal' | 'explosion' | 'flag' | 'cascade';
  targetCells: Coordinate[];
  duration: number;
}