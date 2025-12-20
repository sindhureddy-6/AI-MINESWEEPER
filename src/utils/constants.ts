import { DifficultySettings, DifficultyLevel } from '../types/index'

// Predefined difficulty configurations
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultySettings> = {
  [DifficultyLevel.BEGINNER]: {
    width: 9,
    height: 9,
    mineCount: 10,
    name: 'Beginner'
  },
  [DifficultyLevel.INTERMEDIATE]: {
    width: 16,
    height: 16,
    mineCount: 40,
    name: 'Intermediate'
  },
  [DifficultyLevel.EXPERT]: {
    width: 30,
    height: 16,
    mineCount: 99,
    name: 'Expert'
  },
  [DifficultyLevel.CUSTOM]: {
    width: 16,
    height: 16,
    mineCount: 40,
    name: 'Custom'
  }
}

// Game configuration constants
export const GAME_CONSTANTS = {
  MAX_BOARD_WIDTH: 50,
  MAX_BOARD_HEIGHT: 50,
  MIN_BOARD_WIDTH: 5,
  MIN_BOARD_HEIGHT: 5,
  MAX_MINE_DENSITY: 0.8, // 80% of cells can be mines
  MIN_MINE_COUNT: 1,
  ANIMATION_DURATION: 300, // milliseconds
  HINT_CALCULATION_TIMEOUT: 5000, // milliseconds
  PERFORMANCE_HISTORY_LIMIT: 100, // number of games to track
} as const

// Local storage keys
export const STORAGE_KEYS = {
  GAME_STATE: 'ai-minesweeper-game-state',
  PLAYER_PERFORMANCE: 'ai-minesweeper-performance',
  SETTINGS: 'ai-minesweeper-settings',
  STATISTICS: 'ai-minesweeper-statistics'
} as const