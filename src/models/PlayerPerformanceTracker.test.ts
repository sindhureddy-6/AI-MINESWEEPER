import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerPerformanceTracker } from './PlayerPerformanceTracker';
import { GameResult, DifficultyLevel } from '../types/index';
import { DIFFICULTY_PRESETS } from '../utils/constants';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('PlayerPerformanceTracker', () => {
  let tracker: PlayerPerformanceTracker;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    tracker = new PlayerPerformanceTracker();
  });

  describe('initialization', () => {
    it('should initialize with default performance when no stored data exists', () => {
      const performance = tracker.getPerformance();
      
      expect(performance.gamesPlayed).toBe(0);
      expect(performance.winRate).toBe(0);
      expect(performance.averageTime).toBe(0);
      expect(performance.hintUsageRate).toBe(0);
      expect(performance.difficultyProgression).toEqual([]);
      expect(performance.recentTrends).toEqual([]);
    });

    it('should load existing performance data from localStorage', () => {
      const mockPerformance = {
        gamesPlayed: 10,
        winRate: 0.7,
        averageTime: 120000,
        hintUsageRate: 2.5,
        difficultyProgression: [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE],
        recentTrends: []
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockPerformance));
      
      const newTracker = new PlayerPerformanceTracker();
      const performance = newTracker.getPerformance();
      
      expect(performance.gamesPlayed).toBe(10);
      expect(performance.winRate).toBe(0.7);
      expect(performance.averageTime).toBe(120000);
    });
  });

  describe('recordGame', () => {
    it('should record a successful game result', () => {
      const gameResult: GameResult = {
        success: true,
        duration: 120000,
        hintsUsed: 3,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      };

      tracker.recordGame(gameResult);
      
      const performance = tracker.getPerformance();
      expect(performance.gamesPlayed).toBe(1);
      expect(performance.winRate).toBe(1);
      expect(performance.averageTime).toBe(120000);
      expect(performance.hintUsageRate).toBe(3);
    });

    it('should record a failed game result', () => {
      const gameResult: GameResult = {
        success: false,
        duration: 60000,
        hintsUsed: 1,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      };

      tracker.recordGame(gameResult);
      
      const performance = tracker.getPerformance();
      expect(performance.gamesPlayed).toBe(1);
      expect(performance.winRate).toBe(0);
      expect(performance.averageTime).toBe(60000);
      expect(performance.hintUsageRate).toBe(1);
    });

    it('should update metrics correctly with multiple games', () => {
      const results: GameResult[] = [
        {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        },
        {
          success: false,
          duration: 50000,
          hintsUsed: 4,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        },
        {
          success: true,
          duration: 150000,
          hintsUsed: 1,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        }
      ];

      results.forEach(result => tracker.recordGame(result));
      
      const performance = tracker.getPerformance();
      expect(performance.gamesPlayed).toBe(3);
      expect(performance.winRate).toBe(2/3);
      expect(performance.averageTime).toBe(100000); // (100000 + 50000 + 150000) / 3
      expect(performance.hintUsageRate).toBe(7/3); // (2 + 4 + 1) / 3
    });

    it('should update difficulty progression', () => {
      const beginnerResult: GameResult = {
        success: true,
        duration: 100000,
        hintsUsed: 2,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      };

      const intermediateResult: GameResult = {
        success: true,
        duration: 200000,
        hintsUsed: 3,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
        timestamp: new Date()
      };

      tracker.recordGame(beginnerResult);
      tracker.recordGame(intermediateResult);
      
      const performance = tracker.getPerformance();
      expect(performance.difficultyProgression).toEqual([
        DifficultyLevel.BEGINNER,
        DifficultyLevel.INTERMEDIATE
      ]);
    });
  });

  describe('performance analysis', () => {
    beforeEach(() => {
      // Add some test data
      const testResults: GameResult[] = [
        {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        },
        {
          success: false,
          duration: 50000,
          hintsUsed: 4,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          success: true,
          duration: 150000,
          hintsUsed: 1,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date() // today
        }
      ];

      testResults.forEach(result => tracker.recordGame(result));
    });

    it('should calculate win rate for specific difficulty', () => {
      const beginnerWinRate = tracker.getWinRateForDifficulty('beginner');
      const intermediateWinRate = tracker.getWinRateForDifficulty('intermediate');
      
      expect(beginnerWinRate).toBe(0.5); // 1 win out of 2 games
      expect(intermediateWinRate).toBe(1); // 1 win out of 1 game
    });

    it('should calculate average win time', () => {
      const avgWinTime = tracker.getAverageWinTime();
      expect(avgWinTime).toBe(125000); // (100000 + 150000) / 2
    });

    it('should get recent games', () => {
      const recentGames = tracker.getRecentGames(2);
      expect(recentGames).toHaveLength(2);
      expect(recentGames[1].success).toBe(true); // Most recent game
    });

    it('should get games from specific period', () => {
      const recentGames = tracker.getGamesFromPeriod(7); // Last 7 days
      expect(recentGames).toHaveLength(3); // All games are within 7 days
      
      const veryRecentGames = tracker.getGamesFromPeriod(1); // Last 1 day
      expect(veryRecentGames).toHaveLength(1); // Only today's game
    });

    it('should provide performance summary', () => {
      const summary = tracker.getPerformanceSummary();
      
      expect(summary.totalGames).toBe(3);
      expect(summary.winRate).toBe(2/3);
      expect(summary.averageTime).toBe(100000); // Average of all games
      expect(summary.hintsPerGame).toBe(7/3);
      expect(summary.currentStreak).toBe(1); // Last game was a win
      expect(summary.bestStreak).toBe(1); // Best streak is 1 win
    });
  });

  describe('data persistence', () => {
    it('should save performance data to localStorage', () => {
      const gameResult: GameResult = {
        success: true,
        duration: 120000,
        hintsUsed: 3,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      };

      tracker.recordGame(gameResult);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-minesweeper-performance',
        expect.any(String)
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-minesweeper-statistics',
        expect.any(String)
      );
    });

    it('should clear performance data', () => {
      tracker.clearPerformanceData();
      
      const performance = tracker.getPerformance();
      expect(performance.gamesPlayed).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ai-minesweeper-performance');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('ai-minesweeper-statistics');
    });

    it('should export and import performance data', () => {
      const gameResult: GameResult = {
        success: true,
        duration: 120000,
        hintsUsed: 3,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      };

      tracker.recordGame(gameResult);
      
      const exportedData = tracker.exportPerformanceData();
      expect(exportedData).not.toBeNull();
      expect(exportedData).toContain('"gamesPlayed": 1');
      
      // Clear localStorage to ensure clean import
      localStorage.clear();
      
      const newTracker = new PlayerPerformanceTracker();
      const importSuccess = newTracker.importPerformanceData(exportedData!);
      
      expect(importSuccess).toBe(true);
      expect(newTracker.getPerformance().gamesPlayed).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw and should use default values
      const newTracker = new PlayerPerformanceTracker();
      const performance = newTracker.getPerformance();
      
      expect(performance.gamesPlayed).toBe(0);
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const newTracker = new PlayerPerformanceTracker();
      const performance = newTracker.getPerformance();
      
      expect(performance.gamesPlayed).toBe(0);
    });
  });
});
