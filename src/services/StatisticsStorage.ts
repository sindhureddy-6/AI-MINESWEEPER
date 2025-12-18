import { PlayerPerformance, GameResult, PerformanceTrend, DifficultyLevel } from '../types/index.js';
import { STORAGE_KEYS, GAME_CONSTANTS } from '../utils/constants.js';

/**
 * Serializable performance data for storage
 */
interface SerializablePerformanceData {
  performance: PlayerPerformance;
  gameHistory: {
    success: boolean;
    duration: number;
    hintsUsed: number;
    difficulty: {
      width: number;
      height: number;
      mineCount: number;
      name: string;
    };
    timestamp: string; // ISO string
  }[];
  version: string;
  lastBackup?: string; // ISO string
}

/**
 * StatisticsStorage handles persistence of player performance and game statistics
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export class StatisticsStorage {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly MAX_HISTORY_SIZE = GAME_CONSTANTS.PERFORMANCE_HISTORY_LIMIT;
  private static readonly BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Save performance data to local storage
   * @param performance Current performance metrics
   * @param gameHistory Array of game results
   * @returns True if save was successful
   */
  static savePerformanceData(performance: PlayerPerformance, gameHistory: GameResult[]): boolean {
    try {
      const serializable = this.serializePerformanceData(performance, gameHistory);
      const serialized = JSON.stringify(serializable);
      
      localStorage.setItem(STORAGE_KEYS.PLAYER_PERFORMANCE, serialized);
      
      // Also save game history separately for backwards compatibility
      const historyData = gameHistory.map(result => ({
        ...result,
        timestamp: result.timestamp.toISOString()
      }));
      localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(historyData));
      
      return true;
    } catch (error) {
      console.error('Failed to save performance data:', error);
      
      // Handle quota exceeded by trimming old data
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        return this.handleStorageQuotaExceeded(performance, gameHistory);
      }
      
      return false;
    }
  }

  /**
   * Load performance data from local storage
   * @returns Loaded performance data or default values if not found
   */
  static loadPerformanceData(): { performance: PlayerPerformance; gameHistory: GameResult[] } {
    try {
      // Try to load from new format first
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_PERFORMANCE);
      if (stored) {
        const parsed: SerializablePerformanceData = JSON.parse(stored);
        
        // Validate version and migrate if necessary
        if (this.isValidVersion(parsed.version)) {
          return this.deserializePerformanceData(parsed);
        } else {
          const migrated = this.migratePerformanceData(parsed);
          if (migrated) {
            return this.deserializePerformanceData(migrated);
          }
        }
      }

      // Fallback to old format
      return this.loadLegacyPerformanceData();
    } catch (error) {
      console.error('Failed to load performance data:', error);
      
      // Try to recover from corrupted data
      const recovered = this.recoverCorruptedData();
      if (recovered) {
        return recovered;
      }
      
      return this.createDefaultPerformanceData();
    }
  }

  /**
   * Create backup of performance data
   * @returns Backup data as JSON string or null if failed
   */
  static createBackup(): string | null {
    try {
      const data = this.loadPerformanceData();
      const backup = {
        ...this.serializePerformanceData(data.performance, data.gameHistory),
        backupTimestamp: new Date().toISOString(),
        backupVersion: this.CURRENT_VERSION
      };
      
      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore performance data from backup
   * @param backupData JSON string containing backup data
   * @returns True if restore was successful
   */
  static restoreFromBackup(backupData: string): boolean {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.performance || !backup.gameHistory || !this.isValidVersion(backup.version)) {
        return false;
      }

      const data = this.deserializePerformanceData(backup);
      
      if (!this.validatePerformanceData(data)) {
        return false;
      }

      return this.savePerformanceData(data.performance, data.gameHistory);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Clear all performance data
   */
  static clearPerformanceData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PLAYER_PERFORMANCE);
      localStorage.removeItem(STORAGE_KEYS.STATISTICS);
    } catch (error) {
      console.error('Failed to clear performance data:', error);
    }
  }

  /**
   * Get storage usage information for performance data
   */
  static getStorageInfo(): {
    performanceSize: number;
    historySize: number;
    totalSize: number;
    entryCount: number;
  } {
    try {
      const performanceData = localStorage.getItem(STORAGE_KEYS.PLAYER_PERFORMANCE);
      const historyData = localStorage.getItem(STORAGE_KEYS.STATISTICS);
      
      const performanceSize = performanceData ? performanceData.length : 0;
      const historySize = historyData ? historyData.length : 0;
      
      let entryCount = 0;
      if (historyData) {
        try {
          const parsed = JSON.parse(historyData);
          entryCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          entryCount = 0;
        }
      }

      return {
        performanceSize,
        historySize,
        totalSize: performanceSize + historySize,
        entryCount
      };
    } catch (error) {
      return {
        performanceSize: 0,
        historySize: 0,
        totalSize: 0,
        entryCount: 0
      };
    }
  }

  /**
   * Trim old performance data to free up space
   * @param keepCount Number of recent entries to keep
   */
  static trimPerformanceData(keepCount: number = 50): boolean {
    try {
      const data = this.loadPerformanceData();
      
      if (data.gameHistory.length <= keepCount) {
        return true; // Nothing to trim
      }

      // Keep only the most recent entries
      const trimmedHistory = data.gameHistory.slice(-keepCount);
      
      // Recalculate performance metrics based on trimmed history
      const recalculatedPerformance = this.recalculatePerformanceMetrics(trimmedHistory);
      
      return this.savePerformanceData(recalculatedPerformance, trimmedHistory);
    } catch (error) {
      console.error('Failed to trim performance data:', error);
      return false;
    }
  }

  /**
   * Check if automatic backup is needed
   */
  static needsBackup(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_PERFORMANCE);
      if (!stored) {
        return false;
      }

      const parsed: SerializablePerformanceData = JSON.parse(stored);
      if (!parsed.lastBackup) {
        return true;
      }

      const lastBackup = new Date(parsed.lastBackup);
      const now = new Date();
      
      return (now.getTime() - lastBackup.getTime()) > this.BACKUP_INTERVAL;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update last backup timestamp
   */
  static updateBackupTimestamp(): void {
    try {
      const data = this.loadPerformanceData();
      const serializable = this.serializePerformanceData(data.performance, data.gameHistory);
      serializable.lastBackup = new Date().toISOString();
      
      localStorage.setItem(STORAGE_KEYS.PLAYER_PERFORMANCE, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to update backup timestamp:', error);
    }
  }

  /**
   * Convert performance data to serializable format
   */
  private static serializePerformanceData(
    performance: PlayerPerformance, 
    gameHistory: GameResult[]
  ): SerializablePerformanceData {
    return {
      performance: {
        gamesPlayed: performance.gamesPlayed,
        winRate: performance.winRate,
        averageTime: performance.averageTime,
        hintUsageRate: performance.hintUsageRate,
        difficultyProgression: [...performance.difficultyProgression],
        recentTrends: performance.recentTrends.map(trend => ({ ...trend }))
      },
      gameHistory: gameHistory.map(result => ({
        success: result.success,
        duration: result.duration,
        hintsUsed: result.hintsUsed,
        difficulty: { ...result.difficulty },
        timestamp: result.timestamp.toISOString()
      })),
      version: this.CURRENT_VERSION
    };
  }

  /**
   * Convert serializable format back to performance data
   */
  private static deserializePerformanceData(
    serializable: SerializablePerformanceData
  ): { performance: PlayerPerformance; gameHistory: GameResult[] } {
    return {
      performance: {
        gamesPlayed: serializable.performance.gamesPlayed,
        winRate: serializable.performance.winRate,
        averageTime: serializable.performance.averageTime,
        hintUsageRate: serializable.performance.hintUsageRate,
        difficultyProgression: [...serializable.performance.difficultyProgression],
        recentTrends: serializable.performance.recentTrends.map(trend => ({ ...trend }))
      },
      gameHistory: serializable.gameHistory.map(result => ({
        success: result.success,
        duration: result.duration,
        hintsUsed: result.hintsUsed,
        difficulty: { ...result.difficulty },
        timestamp: new Date(result.timestamp)
      }))
    };
  }

  /**
   * Load performance data from legacy format
   */
  private static loadLegacyPerformanceData(): { performance: PlayerPerformance; gameHistory: GameResult[] } {
    try {
      // Try to load old statistics format
      const historyData = localStorage.getItem(STORAGE_KEYS.STATISTICS);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        
        // Handle case where it's an array (game history)
        if (Array.isArray(parsed)) {
          const gameHistory: GameResult[] = parsed.map((result: any) => ({
            ...result,
            timestamp: new Date(result.timestamp)
          }));

          const performance = this.recalculatePerformanceMetrics(gameHistory);
          return { performance, gameHistory };
        }
      }

      // Try to load old performance format
      const performanceData = localStorage.getItem(STORAGE_KEYS.PLAYER_PERFORMANCE);
      if (performanceData) {
        const parsed = JSON.parse(performanceData);
        
        // If it's the old format without version
        if (!parsed.version && parsed.gamesPlayed !== undefined) {
          return {
            performance: {
              gamesPlayed: parsed.gamesPlayed || 0,
              winRate: parsed.winRate || 0,
              averageTime: parsed.averageTime || 0,
              hintUsageRate: parsed.hintUsageRate || 0,
              difficultyProgression: parsed.difficultyProgression || [],
              recentTrends: parsed.recentTrends || []
            },
            gameHistory: []
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load legacy performance data:', error);
    }

    return this.createDefaultPerformanceData();
  }

  /**
   * Recalculate performance metrics from game history
   */
  private static recalculatePerformanceMetrics(gameHistory: GameResult[]): PlayerPerformance {
    if (gameHistory.length === 0) {
      return this.createDefaultPerformanceData().performance;
    }

    // Calculate basic metrics
    const wins = gameHistory.filter(result => result.success).length;
    const winRate = wins / gameHistory.length;

    const completedGames = gameHistory.filter(result => result.duration > 0);
    const averageTime = completedGames.length > 0
      ? completedGames.reduce((sum, result) => sum + result.duration, 0) / completedGames.length
      : 0;

    const totalHints = gameHistory.reduce((sum, result) => sum + result.hintsUsed, 0);
    const hintUsageRate = totalHints / gameHistory.length;

    // Calculate difficulty progression
    const difficultyProgression: DifficultyLevel[] = [];
    let lastDifficulty: DifficultyLevel | null = null;

    for (const result of gameHistory) {
      const difficultyName = result.difficulty.name.toLowerCase();
      let currentDifficulty: DifficultyLevel;

      switch (difficultyName) {
        case 'beginner':
          currentDifficulty = DifficultyLevel.BEGINNER;
          break;
        case 'intermediate':
          currentDifficulty = DifficultyLevel.INTERMEDIATE;
          break;
        case 'expert':
          currentDifficulty = DifficultyLevel.EXPERT;
          break;
        default:
          currentDifficulty = DifficultyLevel.CUSTOM;
      }

      if (currentDifficulty !== lastDifficulty) {
        difficultyProgression.push(currentDifficulty);
        lastDifficulty = currentDifficulty;
      }
    }

    // Calculate recent trends
    const recentTrends: PerformanceTrend[] = [];
    const now = new Date();

    const periods = [
      { name: 'last_10_games', gameCount: 10 },
      { name: 'last_7_days', days: 7 },
      { name: 'last_30_days', days: 30 }
    ];

    for (const period of periods) {
      let relevantGames: GameResult[];

      if (period.gameCount) {
        relevantGames = gameHistory.slice(-period.gameCount);
      } else if (period.days) {
        const cutoffDate = new Date(now.getTime() - (period.days * 24 * 60 * 60 * 1000));
        relevantGames = gameHistory.filter(result => result.timestamp >= cutoffDate);
      } else {
        continue;
      }

      if (relevantGames.length > 0) {
        const periodWins = relevantGames.filter(result => result.success).length;
        const periodWinRate = periodWins / relevantGames.length;
        
        const periodCompletedGames = relevantGames.filter(result => result.duration > 0);
        const periodAverageTime = periodCompletedGames.length > 0
          ? periodCompletedGames.reduce((sum, result) => sum + result.duration, 0) / periodCompletedGames.length
          : 0;

        recentTrends.push({
          period: period.name,
          winRate: periodWinRate,
          averageTime: periodAverageTime,
          gamesPlayed: relevantGames.length
        });
      }
    }

    return {
      gamesPlayed: gameHistory.length,
      winRate,
      averageTime,
      hintUsageRate,
      difficultyProgression,
      recentTrends
    };
  }

  /**
   * Create default performance data
   */
  private static createDefaultPerformanceData(): { performance: PlayerPerformance; gameHistory: GameResult[] } {
    return {
      performance: {
        gamesPlayed: 0,
        winRate: 0,
        averageTime: 0,
        hintUsageRate: 0,
        difficultyProgression: [],
        recentTrends: []
      },
      gameHistory: []
    };
  }

  /**
   * Check if version is valid/supported
   */
  private static isValidVersion(version: string | undefined): boolean {
    if (!version) {
      return false;
    }
    
    return version === this.CURRENT_VERSION;
  }

  /**
   * Migrate performance data from older versions
   */
  private static migratePerformanceData(oldData: any): SerializablePerformanceData | null {
    try {
      // Handle migration from versions without version field
      if (!oldData.version && oldData.performance && oldData.gameHistory) {
        return {
          ...oldData,
          version: this.CURRENT_VERSION
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to migrate performance data:', error);
      return null;
    }
  }

  /**
   * Validate performance data structure
   */
  private static validatePerformanceData(data: { performance: PlayerPerformance; gameHistory: GameResult[] }): boolean {
    try {
      // Validate performance object
      const perf = data.performance;
      if (typeof perf.gamesPlayed !== 'number' ||
          typeof perf.winRate !== 'number' ||
          typeof perf.averageTime !== 'number' ||
          typeof perf.hintUsageRate !== 'number' ||
          !Array.isArray(perf.difficultyProgression) ||
          !Array.isArray(perf.recentTrends)) {
        return false;
      }

      // Validate game history
      if (!Array.isArray(data.gameHistory)) {
        return false;
      }

      for (const result of data.gameHistory) {
        if (typeof result.success !== 'boolean' ||
            typeof result.duration !== 'number' ||
            typeof result.hintsUsed !== 'number' ||
            !result.difficulty ||
            !(result.timestamp instanceof Date)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle storage quota exceeded error
   */
  private static handleStorageQuotaExceeded(
    performance: PlayerPerformance, 
    gameHistory: GameResult[]
  ): boolean {
    try {
      // Try to trim history and save again
      const trimmedHistory = gameHistory.slice(-Math.floor(this.MAX_HISTORY_SIZE / 2));
      const recalculatedPerformance = this.recalculatePerformanceMetrics(trimmedHistory);
      
      const serializable = this.serializePerformanceData(recalculatedPerformance, trimmedHistory);
      const serialized = JSON.stringify(serializable);
      
      localStorage.setItem(STORAGE_KEYS.PLAYER_PERFORMANCE, serialized);
      
      return true;
    } catch (error) {
      console.error('Failed to handle storage quota exceeded:', error);
      return false;
    }
  }

  /**
   * Attempt to recover from corrupted data
   */
  private static recoverCorruptedData(): { performance: PlayerPerformance; gameHistory: GameResult[] } | null {
    try {
      // Try to recover game history from statistics storage
      const historyData = localStorage.getItem(STORAGE_KEYS.STATISTICS);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        
        if (Array.isArray(parsed)) {
          const gameHistory: GameResult[] = parsed.map((result: any) => ({
            ...result,
            timestamp: new Date(result.timestamp)
          }));

          if (gameHistory.length > 0) {
            const performance = this.recalculatePerformanceMetrics(gameHistory);
            return { performance, gameHistory };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to recover corrupted data:', error);
    }

    return null;
  }
}