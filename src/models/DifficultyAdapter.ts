import { DifficultySettings, DifficultyLevel, GameResult, PlayerPerformance } from '../types/index';
import { DIFFICULTY_PRESETS, GAME_CONSTANTS, STORAGE_KEYS } from '../utils/constants';
import { PlayerPerformanceTracker } from './PlayerPerformanceTracker';

/**
 * Configuration for difficulty adaptation behavior
 */
interface AdaptationConfig {
  successThreshold: number;      // Win rate threshold to increase difficulty
  failureThreshold: number;      // Win rate threshold to decrease difficulty
  minGamesForAdaptation: number; // Minimum games before adaptation kicks in
  adaptationSensitivity: number; // How aggressively to adapt (0-1)
  recentGamesWindow: number;     // Number of recent games to consider
}

/**
 * DifficultyAdapter manages automatic difficulty adjustment based on player performance
 */
export class DifficultyAdapter {
  private performanceTracker: PlayerPerformanceTracker;
  private adaptationEnabled: boolean = true;
  private config: AdaptationConfig;
  private manualDifficultyOverride: DifficultySettings | null = null;

  constructor(performanceTracker: PlayerPerformanceTracker, config?: Partial<AdaptationConfig>) {
    this.performanceTracker = performanceTracker;
    this.config = {
      successThreshold: 0.75,      // Increase difficulty if win rate > 75%
      failureThreshold: 0.35,      // Decrease difficulty if win rate < 35%
      minGamesForAdaptation: 5,    // Need at least 5 games
      adaptationSensitivity: 0.3,  // Moderate adaptation speed
      recentGamesWindow: 10,       // Look at last 10 games
      ...config
    };

    this.loadSettings();
  }

  /**
   * Load adapter settings from local storage
   */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const settings = JSON.parse(stored);
        this.adaptationEnabled = settings.adaptationEnabled ?? true;
        this.manualDifficultyOverride = settings.manualDifficultyOverride || null;
        
        if (settings.adaptationConfig) {
          this.config = { ...this.config, ...settings.adaptationConfig };
        }
      }
    } catch (error) {
      console.warn('Failed to load difficulty adapter settings:', error);
    }
  }

  /**
   * Save adapter settings to local storage
   */
  private saveSettings(): void {
    try {
      const settings = {
        adaptationEnabled: this.adaptationEnabled,
        manualDifficultyOverride: this.manualDifficultyOverride,
        adaptationConfig: this.config
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save difficulty adapter settings:', error);
    }
  }

  /**
   * Get recommended difficulty based on player performance
   */
  getRecommendedDifficulty(): DifficultySettings {
    // If manual override is set, return it
    if (this.manualDifficultyOverride) {
      return this.manualDifficultyOverride;
    }

    // If adaptation is disabled, return beginner
    if (!this.adaptationEnabled) {
      return DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER];
    }

    const performance = this.performanceTracker.getPerformance();
    
    // If not enough games played, start with beginner
    if (performance.gamesPlayed < this.config.minGamesForAdaptation) {
      return DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER];
    }

    // Analyze recent performance
    const recentGames = this.performanceTracker.getRecentGames(this.config.recentGamesWindow);
    const recentWinRate = this.calculateWinRate(recentGames);
    
    // Get current difficulty level from recent games
    const currentDifficulty = this.getCurrentDifficultyLevel(recentGames);
    
    // Determine if adaptation is needed
    const adaptationDirection = this.determineAdaptationDirection(recentWinRate, performance);
    
    if (adaptationDirection === 0) {
      // No adaptation needed, return current difficulty
      return this.getDifficultySettings(currentDifficulty);
    }

    // Calculate new difficulty
    return this.calculateNewDifficulty(currentDifficulty, adaptationDirection, recentWinRate);
  }

  /**
   * Calculate win rate from game results
   */
  private calculateWinRate(games: GameResult[]): number {
    if (games.length === 0) return 0;
    const wins = games.filter(game => game.success).length;
    return wins / games.length;
  }

  /**
   * Get current difficulty level from recent games
   */
  private getCurrentDifficultyLevel(recentGames: GameResult[]): DifficultyLevel {
    if (recentGames.length === 0) {
      return DifficultyLevel.BEGINNER;
    }

    // Use the most recent game's difficulty
    const lastGame = recentGames[recentGames.length - 1];
    return this.difficultySettingsToLevel(lastGame.difficulty);
  }

  /**
   * Convert difficulty settings to difficulty level
   */
  private difficultySettingsToLevel(settings: DifficultySettings): DifficultyLevel {
    // Check against presets
    for (const [level, preset] of Object.entries(DIFFICULTY_PRESETS)) {
      if (preset.width === settings.width && 
          preset.height === settings.height && 
          preset.mineCount === settings.mineCount) {
        return level as DifficultyLevel;
      }
    }
    return DifficultyLevel.CUSTOM;
  }

  /**
   * Determine if difficulty should be increased (+1), decreased (-1), or stay same (0)
   */
  private determineAdaptationDirection(recentWinRate: number, _overallPerformance: PlayerPerformance): number {
    // Check if player is consistently winning (increase difficulty)
    if (recentWinRate >= this.config.successThreshold) {
      return 1;
    }
    
    // Check if player is consistently losing (decrease difficulty)
    if (recentWinRate <= this.config.failureThreshold) {
      return -1;
    }

    // Check for improvement trends
    const isImproving = this.performanceTracker.isImproving();
    if (isImproving && recentWinRate > 0.6) {
      return 1; // Player is improving and doing well, increase challenge
    }

    return 0; // No change needed
  }

  /**
   * Calculate new difficulty based on adaptation direction
   */
  private calculateNewDifficulty(
    currentLevel: DifficultyLevel, 
    direction: number, 
    winRate: number
  ): DifficultySettings {
    const levelOrder = [
      DifficultyLevel.BEGINNER,
      DifficultyLevel.INTERMEDIATE,
      DifficultyLevel.EXPERT
    ];

    const currentIndex = levelOrder.indexOf(currentLevel);
    
    if (direction > 0) {
      // Increase difficulty
      if (currentIndex < levelOrder.length - 1) {
        return DIFFICULTY_PRESETS[levelOrder[currentIndex + 1]];
      } else {
        // Already at expert, create custom harder difficulty
        return this.createHarderCustomDifficulty(DIFFICULTY_PRESETS[DifficultyLevel.EXPERT], winRate);
      }
    } else if (direction < 0) {
      // Decrease difficulty
      if (currentIndex > 0) {
        return DIFFICULTY_PRESETS[levelOrder[currentIndex - 1]];
      } else {
        // Already at beginner, create easier custom difficulty
        return this.createEasierCustomDifficulty(DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER], winRate);
      }
    }

    // No change
    return this.getDifficultySettings(currentLevel);
  }

  /**
   * Create a harder custom difficulty
   */
  private createHarderCustomDifficulty(baseDifficulty: DifficultySettings, winRate: number): DifficultySettings {
    const adaptationFactor = 1 + (this.config.adaptationSensitivity * (winRate - this.config.successThreshold));
    
    // Increase mine count while keeping board size reasonable
    const newMineCount = Math.min(
      Math.floor(baseDifficulty.mineCount * adaptationFactor),
      Math.floor(baseDifficulty.width * baseDifficulty.height * GAME_CONSTANTS.MAX_MINE_DENSITY)
    );

    return {
      width: baseDifficulty.width,
      height: baseDifficulty.height,
      mineCount: newMineCount,
      name: 'Custom Hard'
    };
  }

  /**
   * Create an easier custom difficulty
   */
  private createEasierCustomDifficulty(baseDifficulty: DifficultySettings, winRate: number): DifficultySettings {
    const adaptationFactor = 1 - (this.config.adaptationSensitivity * (this.config.failureThreshold - winRate));
    
    // Decrease mine count
    const newMineCount = Math.max(
      Math.floor(baseDifficulty.mineCount * adaptationFactor),
      GAME_CONSTANTS.MIN_MINE_COUNT
    );

    return {
      width: baseDifficulty.width,
      height: baseDifficulty.height,
      mineCount: newMineCount,
      name: 'Custom Easy'
    };
  }

  /**
   * Get difficulty settings for a given level
   */
  private getDifficultySettings(level: DifficultyLevel): DifficultySettings {
    return DIFFICULTY_PRESETS[level] || DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER];
  }

  /**
   * Update performance and potentially adapt difficulty
   */
  updatePerformance(gameResult: GameResult): DifficultySettings {
    this.performanceTracker.recordGame(gameResult);
    return this.getRecommendedDifficulty();
  }

  /**
   * Set manual difficulty override (disables automatic adaptation)
   */
  setManualDifficulty(difficulty: DifficultySettings): void {
    this.manualDifficultyOverride = difficulty;
    this.adaptationEnabled = false;
    this.saveSettings();
  }

  /**
   * Clear manual difficulty override and re-enable adaptation
   */
  enableAutomaticAdaptation(): void {
    this.manualDifficultyOverride = null;
    this.adaptationEnabled = true;
    this.saveSettings();
  }

  /**
   * Check if automatic adaptation is enabled
   */
  isAdaptationEnabled(): boolean {
    return this.adaptationEnabled && !this.manualDifficultyOverride;
  }

  /**
   * Get current manual difficulty override
   */
  getManualDifficultyOverride(): DifficultySettings | null {
    return this.manualDifficultyOverride;
  }

  /**
   * Update adaptation configuration
   */
  updateConfig(newConfig: Partial<AdaptationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveSettings();
  }

  /**
   * Get current adaptation configuration
   */
  getConfig(): AdaptationConfig {
    return { ...this.config };
  }

  /**
   * Get adaptation status and recommendations
   */
  getAdaptationStatus(): {
    isEnabled: boolean;
    currentDifficulty: DifficultySettings;
    recommendedDifficulty: DifficultySettings;
    adaptationReason: string;
    recentPerformance: {
      winRate: number;
      gamesPlayed: number;
      trend: 'improving' | 'declining' | 'stable';
    };
  } {
    const currentDifficulty = this.manualDifficultyOverride || DIFFICULTY_PRESETS[DifficultyLevel.BEGINNER];
    const recommendedDifficulty = this.getRecommendedDifficulty();
    const recentGames = this.performanceTracker.getRecentGames(this.config.recentGamesWindow);
    const recentWinRate = this.calculateWinRate(recentGames);
    const isImproving = this.performanceTracker.isImproving();

    let adaptationReason = 'No adaptation needed';
    let trend: 'improving' | 'declining' | 'stable' = 'stable';

    if (!this.isAdaptationEnabled()) {
      adaptationReason = 'Manual difficulty override active';
    } else if (recentGames.length < this.config.minGamesForAdaptation) {
      adaptationReason = `Need ${this.config.minGamesForAdaptation - recentGames.length} more games for adaptation`;
    } else {
      if (recentWinRate >= this.config.successThreshold) {
        adaptationReason = 'High win rate - increasing difficulty';
        trend = 'improving';
      } else if (recentWinRate <= this.config.failureThreshold) {
        adaptationReason = 'Low win rate - decreasing difficulty';
        trend = 'declining';
      } else if (isImproving) {
        adaptationReason = 'Performance improving - may increase difficulty soon';
        trend = 'improving';
      }
    }

    return {
      isEnabled: this.isAdaptationEnabled(),
      currentDifficulty,
      recommendedDifficulty,
      adaptationReason,
      recentPerformance: {
        winRate: recentWinRate,
        gamesPlayed: recentGames.length,
        trend
      }
    };
  }

  /**
   * Reset all adaptation data
   */
  reset(): void {
    this.manualDifficultyOverride = null;
    this.adaptationEnabled = true;
    this.config = {
      successThreshold: 0.75,
      failureThreshold: 0.35,
      minGamesForAdaptation: 5,
      adaptationSensitivity: 0.3,
      recentGamesWindow: 10
    };
    this.saveSettings();
  }

  /**
   * Simulate difficulty progression for testing
   */
  simulateProgression(gameResults: GameResult[]): DifficultySettings[] {
    const progression: DifficultySettings[] = [];
    
    // Temporarily disable saving during simulation
    const originalSaveSettings = this.saveSettings;
    this.saveSettings = () => {};

    try {
      for (const result of gameResults) {
        const newDifficulty = this.updatePerformance(result);
        progression.push(newDifficulty);
      }
    } finally {
      // Restore saving
      this.saveSettings = originalSaveSettings;
    }

    return progression;
  }
}