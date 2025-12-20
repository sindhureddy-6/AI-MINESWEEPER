import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DifficultyAdapter } from './DifficultyAdapter';
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

describe('DifficultyAdapter', () => {
  let adapter: DifficultyAdapter;
  let performanceTracker: PlayerPerformanceTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    performanceTracker = new PlayerPerformanceTracker();
    adapter = new DifficultyAdapter(performanceTracker);
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = adapter.getConfig();
      
      expect(config.successThreshold).toBe(0.75);
      expect(config.failureThreshold).toBe(0.35);
      expect(config.minGamesForAdaptation).toBe(5);
      expect(config.adaptationSensitivity).toBe(0.3);
      expect(config.recentGamesWindow).toBe(10);
    });

    it('should allow custom configuration', () => {
      const customConfig = {
        successThreshold: 0.8,
        failureThreshold: 0.3,
        minGamesForAdaptation: 3
      };

      const customAdapter = new DifficultyAdapter(performanceTracker, customConfig);
      const config = customAdapter.getConfig();
      
      expect(config.successThreshold).toBe(0.8);
      expect(config.failureThreshold).toBe(0.3);
      expect(config.minGamesForAdaptation).toBe(3);
    });

    it('should start with adaptation enabled', () => {
      expect(adapter.isAdaptationEnabled()).toBe(true);
    });
  });

  describe('difficulty recommendation', () => {
    it('should recommend beginner difficulty for new players', () => {
      const difficulty = adapter.getRecommendedDifficulty();
      expect(difficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
    });

    it('should recommend beginner difficulty with insufficient games', () => {
      // Add only 3 games (less than minGamesForAdaptation = 5)
      for (let i = 0; i < 3; i++) {
        const result: GameResult = {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const difficulty = adapter.getRecommendedDifficulty();
      expect(difficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
    });

    it('should increase difficulty for high win rate', () => {
      // Add 6 successful games (win rate = 100%, above successThreshold = 75%)
      for (let i = 0; i < 6; i++) {
        const result: GameResult = {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const difficulty = adapter.getRecommendedDifficulty();
      expect(difficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
    });

    it('should decrease difficulty for low win rate', () => {
      // Start with intermediate difficulty and add mostly failed games
      const results: GameResult[] = [
        // First game successful to establish intermediate level
        {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        },
        // Then add 5 failed games (win rate = 1/6 = 16.7%, below failureThreshold = 35%)
        ...Array(5).fill(null).map(() => ({
          success: false,
          duration: 50000,
          hintsUsed: 5,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        }))
      ];

      results.forEach(result => adapter.updatePerformance(result));

      const difficulty = adapter.getRecommendedDifficulty();
      expect(difficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
    });

    it('should maintain difficulty for moderate win rate', () => {
      // Add games with moderate win rate (50%, between thresholds)
      const results: GameResult[] = [
        ...Array(3).fill(null).map(() => ({
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        })),
        ...Array(3).fill(null).map(() => ({
          success: false,
          duration: 50000,
          hintsUsed: 5,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        }))
      ];

      results.forEach(result => adapter.updatePerformance(result));

      const difficulty = adapter.getRecommendedDifficulty();
      expect(difficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
    });
  });

  describe('manual difficulty override', () => {
    it('should allow setting manual difficulty', () => {
      const customDifficulty = DIFFICULTY_PRESETS[DifficultyLevel.EXPERT];
      adapter.setManualDifficulty(customDifficulty);

      expect(adapter.isAdaptationEnabled()).toBe(false);
      expect(adapter.getManualDifficultyOverride()).toEqual(customDifficulty);
      expect(adapter.getRecommendedDifficulty()).toEqual(customDifficulty);
    });

    it('should return to automatic adaptation when enabled', () => {
      // Set manual difficulty first
      adapter.setManualDifficulty(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT]);
      expect(adapter.isAdaptationEnabled()).toBe(false);

      // Re-enable automatic adaptation
      adapter.enableAutomaticAdaptation();
      expect(adapter.isAdaptationEnabled()).toBe(true);
      expect(adapter.getManualDifficultyOverride()).toBeNull();
    });

    it('should persist manual difficulty override', () => {
      const customDifficulty = DIFFICULTY_PRESETS[DifficultyLevel.EXPERT];
      adapter.setManualDifficulty(customDifficulty);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-minesweeper-settings',
        expect.stringContaining('"adaptationEnabled":false')
      );
    });
  });

  describe('custom difficulty creation', () => {
    it('should create harder custom difficulty when at expert level', () => {
      // Add many successful games at expert level
      for (let i = 0; i < 8; i++) {
        const result: GameResult = {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.EXPERT],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const difficulty = adapter.getRecommendedDifficulty();
      
      // Should create custom difficulty with more mines
      expect(difficulty.name).toBe('Custom Hard');
      expect(difficulty.mineCount).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT].mineCount);
      expect(difficulty.width).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT].width);
      expect(difficulty.height).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT].height);
    });

    it('should create easier custom difficulty when at beginner level', () => {
      // Add many failed games at beginner level
      for (let i = 0; i < 8; i++) {
        const result: GameResult = {
          success: false,
          duration: 50000,
          hintsUsed: 5,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const difficulty = adapter.getRecommendedDifficulty();
      
      // Should create custom difficulty with fewer mines
      expect(difficulty.name).toBe('Custom Easy');
      expect(difficulty.mineCount).toBeLessThan(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER].mineCount);
      expect(difficulty.width).toBe(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER].width);
      expect(difficulty.height).toBe(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER].height);
    });
  });

  describe('adaptation status', () => {
    it('should provide comprehensive adaptation status', () => {
      // Add some games
      for (let i = 0; i < 6; i++) {
        const result: GameResult = {
          success: i < 5, // 5 wins, 1 loss = 83% win rate
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const status = adapter.getAdaptationStatus();
      
      expect(status.isEnabled).toBe(true);
      expect(status.recentPerformance.winRate).toBeCloseTo(5/6);
      expect(status.recentPerformance.gamesPlayed).toBe(6);
      expect(status.adaptationReason).toContain('High win rate');
      expect(status.recommendedDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
    });

    it('should indicate when insufficient games for adaptation', () => {
      // Add only 2 games
      for (let i = 0; i < 2; i++) {
        const result: GameResult = {
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        };
        adapter.updatePerformance(result);
      }

      const status = adapter.getAdaptationStatus();
      expect(status.adaptationReason).toContain('Need 3 more games');
    });
  });

  describe('configuration management', () => {
    it('should allow updating configuration', () => {
      const newConfig = {
        successThreshold: 0.9,
        failureThreshold: 0.2
      };

      adapter.updateConfig(newConfig);
      const config = adapter.getConfig();

      expect(config.successThreshold).toBe(0.9);
      expect(config.failureThreshold).toBe(0.2);
      expect(config.minGamesForAdaptation).toBe(5); // Should keep existing values
    });

    it('should save configuration changes', () => {
      adapter.updateConfig({ successThreshold: 0.9 });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-minesweeper-settings',
        expect.any(String)
      );
    });
  });

  describe('simulation and testing', () => {
    it('should simulate difficulty progression', () => {
      const gameResults: GameResult[] = [
        // Start with successful games
        ...Array(6).fill(null).map(() => ({
          success: true,
          duration: 100000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        })),
        // Then add some failures
        ...Array(4).fill(null).map(() => ({
          success: false,
          duration: 50000,
          hintsUsed: 5,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
          timestamp: new Date()
        }))
      ];

      const progression = adapter.simulateProgression(gameResults);
      
      expect(progression).toHaveLength(10);
      // Should show progression from beginner to intermediate and potentially back
      expect(progression[5]).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
    });

    it('should reset to default state', () => {
      // Modify adapter state
      adapter.setManualDifficulty(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT]);
      adapter.updateConfig({ successThreshold: 0.9 });

      // Reset
      adapter.reset();

      expect(adapter.isAdaptationEnabled()).toBe(true);
      expect(adapter.getManualDifficultyOverride()).toBeNull();
      expect(adapter.getConfig().successThreshold).toBe(0.75);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw and should use default values
      const newAdapter = new DifficultyAdapter(performanceTracker);
      expect(newAdapter.isAdaptationEnabled()).toBe(true);
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const newAdapter = new DifficultyAdapter(performanceTracker);
      expect(newAdapter.isAdaptationEnabled()).toBe(true);
    });
  });
});