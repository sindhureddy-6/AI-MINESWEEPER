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

describe('Adaptive Difficulty System Integration', () => {
  let performanceTracker: PlayerPerformanceTracker;
  let difficultyAdapter: DifficultyAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    performanceTracker = new PlayerPerformanceTracker();
    difficultyAdapter = new DifficultyAdapter(performanceTracker);
  });

  describe('complete adaptive difficulty workflow', () => {
    it('should demonstrate full adaptive difficulty lifecycle', () => {
      // 1. New player starts with beginner difficulty
      let currentDifficulty = difficultyAdapter.getRecommendedDifficulty();
      expect(currentDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
      expect(difficultyAdapter.isAdaptationEnabled()).toBe(true);

      // 2. Player plays several successful games
      const successfulGames: GameResult[] = Array(6).fill(null).map(() => ({
        success: true,
        duration: 120000,
        hintsUsed: 2,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      }));

      successfulGames.forEach(result => {
        currentDifficulty = difficultyAdapter.updatePerformance(result);
      });

      // Should increase to intermediate difficulty
      expect(currentDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);

      // 3. Player continues to succeed at intermediate level
      const moreSuccessfulGames: GameResult[] = Array(6).fill(null).map(() => ({
        success: true,
        duration: 180000,
        hintsUsed: 3,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
        timestamp: new Date()
      }));

      moreSuccessfulGames.forEach(result => {
        currentDifficulty = difficultyAdapter.updatePerformance(result);
      });

      // Should increase to expert difficulty
      expect(currentDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT]);

      // 4. Player decides to manually set difficulty to intermediate
      difficultyAdapter.setManualDifficulty(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
      
      expect(difficultyAdapter.isAdaptationEnabled()).toBe(false);
      expect(difficultyAdapter.getManualDifficultyOverride()).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);
      expect(difficultyAdapter.getRecommendedDifficulty()).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);

      // 5. Even with more successful games, difficulty stays at manual setting
      const moreGames: GameResult[] = Array(5).fill(null).map(() => ({
        success: true,
        duration: 100000,
        hintsUsed: 1,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
        timestamp: new Date()
      }));

      moreGames.forEach(result => {
        currentDifficulty = difficultyAdapter.updatePerformance(result);
      });

      // Should still be intermediate (manual override)
      expect(currentDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE]);

      // 6. Player re-enables automatic adaptation
      difficultyAdapter.enableAutomaticAdaptation();
      
      expect(difficultyAdapter.isAdaptationEnabled()).toBe(true);
      expect(difficultyAdapter.getManualDifficultyOverride()).toBeNull();

      // 7. System should now recommend based on recent performance
      currentDifficulty = difficultyAdapter.getRecommendedDifficulty();
      // With high recent win rate, should recommend expert or custom hard
      expect(currentDifficulty.mineCount).toBeGreaterThanOrEqual(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT].mineCount);
    });

    it('should handle difficulty decrease scenario', () => {
      // Start at intermediate level with some successful games
      const initialGames: GameResult[] = Array(3).fill(null).map(() => ({
        success: true,
        duration: 120000,
        hintsUsed: 2,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
        timestamp: new Date()
      }));

      initialGames.forEach(result => difficultyAdapter.updatePerformance(result));

      // Then player starts failing frequently
      const failedGames: GameResult[] = Array(6).fill(null).map(() => ({
        success: false,
        duration: 60000,
        hintsUsed: 8,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE],
        timestamp: new Date()
      }));

      let currentDifficulty: any;
      failedGames.forEach(result => {
        currentDifficulty = difficultyAdapter.updatePerformance(result);
      });

      // Should decrease to beginner difficulty
      expect(currentDifficulty).toEqual(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER]);
    });

    it('should provide comprehensive status information', () => {
      // Add some game history
      const mixedGames: GameResult[] = [
        ...Array(4).fill(null).map(() => ({
          success: true,
          duration: 120000,
          hintsUsed: 2,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        })),
        ...Array(2).fill(null).map(() => ({
          success: false,
          duration: 60000,
          hintsUsed: 5,
          difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
          timestamp: new Date()
        }))
      ];

      mixedGames.forEach(result => difficultyAdapter.updatePerformance(result));

      const status = difficultyAdapter.getAdaptationStatus();
      
      expect(status.isEnabled).toBe(true);
      expect(status.recentPerformance.gamesPlayed).toBe(6);
      expect(status.recentPerformance.winRate).toBeCloseTo(4/6);
      expect(status.adaptationReason).toBeDefined();
      expect(status.currentDifficulty).toBeDefined();
      expect(status.recommendedDifficulty).toBeDefined();
    });

    it('should handle custom difficulty creation at extremes', () => {
      // Test custom harder difficulty creation
      const expertSuccessGames: GameResult[] = Array(8).fill(null).map(() => ({
        success: true,
        duration: 300000,
        hintsUsed: 1,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.EXPERT],
        timestamp: new Date()
      }));

      expertSuccessGames.forEach(result => difficultyAdapter.updatePerformance(result));
      
      const harderDifficulty = difficultyAdapter.getRecommendedDifficulty();
      expect(harderDifficulty.name).toBe('Custom Hard');
      expect(harderDifficulty.mineCount).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT].mineCount);

      // Reset and test custom easier difficulty creation
      difficultyAdapter.reset();
      performanceTracker.clearPerformanceData();

      const beginnerFailGames: GameResult[] = Array(8).fill(null).map(() => ({
        success: false,
        duration: 30000,
        hintsUsed: 10,
        difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER],
        timestamp: new Date()
      }));

      beginnerFailGames.forEach(result => difficultyAdapter.updatePerformance(result));
      
      const easierDifficulty = difficultyAdapter.getRecommendedDifficulty();
      expect(easierDifficulty.name).toBe('Custom Easy');
      expect(easierDifficulty.mineCount).toBeLessThan(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER].mineCount);
    });
  });

  describe('performance tracking integration', () => {
    it('should track performance metrics correctly with difficulty changes', () => {
      // Play games across different difficulties
      const gameSequence: GameResult[] = [
        // Beginner games
        { success: true, duration: 60000, hintsUsed: 1, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        { success: true, duration: 70000, hintsUsed: 2, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        { success: true, duration: 50000, hintsUsed: 1, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        { success: true, duration: 80000, hintsUsed: 3, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        { success: true, duration: 65000, hintsUsed: 2, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        { success: true, duration: 75000, hintsUsed: 1, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], timestamp: new Date() },
        
        // Intermediate games (after automatic progression)
        { success: true, duration: 120000, hintsUsed: 3, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE], timestamp: new Date() },
        { success: false, duration: 90000, hintsUsed: 5, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE], timestamp: new Date() },
        { success: true, duration: 150000, hintsUsed: 4, difficulty: DIFFICULTY_PRESETS[DifficultyLevel.INTERMEDIATE], timestamp: new Date() },
      ];

      gameSequence.forEach(result => difficultyAdapter.updatePerformance(result));

      const performance = performanceTracker.getPerformance();
      expect(performance.gamesPlayed).toBe(9);
      expect(performance.winRate).toBeCloseTo(8/9);
      expect(performance.averageTime).toBeGreaterThan(0);
      expect(performance.hintUsageRate).toBeGreaterThan(0);

      // Check difficulty progression tracking
      expect(performance.difficultyProgression).toContain(DifficultyLevel.BEGINNER);
      expect(performance.difficultyProgression).toContain(DifficultyLevel.INTERMEDIATE);

      // Check win rates by difficulty
      const beginnerWinRate = performanceTracker.getWinRateForDifficulty('beginner');
      const intermediateWinRate = performanceTracker.getWinRateForDifficulty('intermediate');
      
      expect(beginnerWinRate).toBe(1.0); // 6/6 wins
      expect(intermediateWinRate).toBeCloseTo(2/3); // 2/3 wins
    });
  });

  describe('persistence and recovery', () => {
    it('should persist and restore manual difficulty settings', () => {
      // Set manual difficulty
      const customDifficulty = DIFFICULTY_PRESETS[DifficultyLevel.EXPERT];
      difficultyAdapter.setManualDifficulty(customDifficulty);

      // Verify localStorage was called
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'ai-minesweeper-settings',
        expect.stringContaining('"adaptationEnabled":false')
      );

      // Simulate loading from storage
      const mockSettings = {
        adaptationEnabled: false,
        manualDifficultyOverride: customDifficulty,
        adaptationConfig: difficultyAdapter.getConfig()
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));
      
      // Create new adapter (simulates app restart)
      const newAdapter = new DifficultyAdapter(performanceTracker);
      
      expect(newAdapter.isAdaptationEnabled()).toBe(false);
      expect(newAdapter.getManualDifficultyOverride()).toEqual(customDifficulty);
      expect(newAdapter.getRecommendedDifficulty()).toEqual(customDifficulty);
    });
  });
});