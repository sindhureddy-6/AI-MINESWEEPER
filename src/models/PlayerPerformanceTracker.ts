import { PlayerPerformance, GameResult, DifficultyLevel, PerformanceTrend } from '../types/index';
import { GAME_CONSTANTS } from '../utils/constants';
import { StatisticsStorage } from '../services/StatisticsStorage';

/**
 * PlayerPerformanceTracker manages player statistics and performance metrics
 */
export class PlayerPerformanceTracker {
  private performance: PlayerPerformance;
  private gameHistory: GameResult[] = [];

  constructor() {
    const data = StatisticsStorage.loadPerformanceData();
    this.performance = data.performance;
    this.gameHistory = data.gameHistory;
  }



  /**
   * Create default performance object
   */
  private createDefaultPerformance(): PlayerPerformance {
    return {
      gamesPlayed: 0,
      winRate: 0,
      averageTime: 0,
      hintUsageRate: 0,
      difficultyProgression: [],
      recentTrends: []
    };
  }

  /**
   * Record a completed game result
   */
  recordGame(result: GameResult): void {
    // Add to game history
    this.gameHistory.push(result);

    // Limit history size to prevent excessive storage usage
    if (this.gameHistory.length > GAME_CONSTANTS.PERFORMANCE_HISTORY_LIMIT) {
      this.gameHistory = this.gameHistory.slice(-GAME_CONSTANTS.PERFORMANCE_HISTORY_LIMIT);
    }

    // Update performance metrics
    this.updatePerformanceMetrics();

    // Update difficulty progression
    this.updateDifficultyProgression(result);

    // Update recent trends
    this.updateRecentTrends();

    // Save to storage using new storage service
    StatisticsStorage.savePerformanceData(this.performance, this.gameHistory);
  }

  /**
   * Update overall performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (this.gameHistory.length === 0) {
      return;
    }

    // Calculate win rate
    const wins = this.gameHistory.filter(result => result.success).length;
    this.performance.winRate = wins / this.gameHistory.length;

    // Calculate average time (only for completed games)
    const completedGames = this.gameHistory.filter(result => result.duration > 0);
    if (completedGames.length > 0) {
      const totalTime = completedGames.reduce((sum, result) => sum + result.duration, 0);
      this.performance.averageTime = totalTime / completedGames.length;
    }

    // Calculate hint usage rate
    const totalHints = this.gameHistory.reduce((sum, result) => sum + result.hintsUsed, 0);
    this.performance.hintUsageRate = totalHints / this.gameHistory.length;

    // Update games played
    this.performance.gamesPlayed = this.gameHistory.length;
  }

  /**
   * Update difficulty progression tracking
   */
  private updateDifficultyProgression(result: GameResult): void {
    const difficultyName = result.difficulty.name.toLowerCase();
    let difficultyLevel: DifficultyLevel;

    switch (difficultyName) {
      case 'beginner':
        difficultyLevel = DifficultyLevel.BEGINNER;
        break;
      case 'intermediate':
        difficultyLevel = DifficultyLevel.INTERMEDIATE;
        break;
      case 'expert':
        difficultyLevel = DifficultyLevel.EXPERT;
        break;
      default:
        difficultyLevel = DifficultyLevel.CUSTOM;
    }

    // Add to progression if it's a new difficulty or different from the last one
    if (this.performance.difficultyProgression.length === 0 || 
        this.performance.difficultyProgression[this.performance.difficultyProgression.length - 1] !== difficultyLevel) {
      this.performance.difficultyProgression.push(difficultyLevel);
    }
  }

  /**
   * Update recent performance trends
   */
  private updateRecentTrends(): void {
    const trends: PerformanceTrend[] = [];
    const now = new Date();

    // Calculate trends for different time periods
    const periods = [
      { name: 'last_10_games', days: null, gameCount: 10 },
      { name: 'last_7_days', days: 7, gameCount: null },
      { name: 'last_30_days', days: 30, gameCount: null }
    ];

    for (const period of periods) {
      let relevantGames: GameResult[];

      if (period.gameCount) {
        // Get last N games
        relevantGames = this.gameHistory.slice(-period.gameCount);
      } else if (period.days) {
        // Get games from last N days
        const cutoffDate = new Date(now.getTime() - (period.days * 24 * 60 * 60 * 1000));
        relevantGames = this.gameHistory.filter(result => result.timestamp >= cutoffDate);
      } else {
        continue;
      }

      if (relevantGames.length > 0) {
        const wins = relevantGames.filter(result => result.success).length;
        const winRate = wins / relevantGames.length;
        
        const completedGames = relevantGames.filter(result => result.duration > 0);
        const averageTime = completedGames.length > 0 
          ? completedGames.reduce((sum, result) => sum + result.duration, 0) / completedGames.length
          : 0;

        trends.push({
          period: period.name,
          winRate,
          averageTime,
          gamesPlayed: relevantGames.length
        });
      }
    }

    this.performance.recentTrends = trends;
  }

  /**
   * Get current performance data
   */
  getPerformance(): PlayerPerformance {
    return { ...this.performance };
  }

  /**
   * Get game history
   */
  getGameHistory(): GameResult[] {
    return [...this.gameHistory];
  }

  /**
   * Get recent games (last N games)
   */
  getRecentGames(count: number = 10): GameResult[] {
    return this.gameHistory.slice(-count);
  }

  /**
   * Get games from a specific time period
   */
  getGamesFromPeriod(days: number): GameResult[] {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return this.gameHistory.filter(result => result.timestamp >= cutoffDate);
  }

  /**
   * Get win rate for a specific difficulty
   */
  getWinRateForDifficulty(difficultyName: string): number {
    const difficultyGames = this.gameHistory.filter(
      result => result.difficulty.name.toLowerCase() === difficultyName.toLowerCase()
    );
    
    if (difficultyGames.length === 0) {
      return 0;
    }

    const wins = difficultyGames.filter(result => result.success).length;
    return wins / difficultyGames.length;
  }

  /**
   * Get average completion time for successful games
   */
  getAverageWinTime(): number {
    const successfulGames = this.gameHistory.filter(result => result.success && result.duration > 0);
    
    if (successfulGames.length === 0) {
      return 0;
    }

    const totalTime = successfulGames.reduce((sum, result) => sum + result.duration, 0);
    return totalTime / successfulGames.length;
  }

  /**
   * Check if player is improving (based on recent trends)
   */
  isImproving(): boolean {
    const recentTrend = this.performance.recentTrends.find(trend => trend.period === 'last_10_games');
    
    if (!recentTrend || this.performance.gamesPlayed < 20) {
      return false; // Not enough data
    }

    // Compare recent performance to overall performance
    return recentTrend.winRate > this.performance.winRate;
  }

  /**
   * Get performance summary for display
   */
  getPerformanceSummary(): {
    totalGames: number;
    winRate: number;
    averageTime: number;
    hintsPerGame: number;
    currentStreak: number;
    bestStreak: number;
  } {
    const currentStreak = this.getCurrentStreak();
    const bestStreak = this.getBestStreak();

    return {
      totalGames: this.performance.gamesPlayed,
      winRate: this.performance.winRate,
      averageTime: this.performance.averageTime,
      hintsPerGame: this.performance.hintUsageRate,
      currentStreak,
      bestStreak
    };
  }

  /**
   * Get current win/loss streak
   */
  getCurrentStreak(): number {
    if (this.gameHistory.length === 0) {
      return 0;
    }

    let streak = 0;
    const lastResult = this.gameHistory[this.gameHistory.length - 1].success;

    for (let i = this.gameHistory.length - 1; i >= 0; i--) {
      if (this.gameHistory[i].success === lastResult) {
        streak++;
      } else {
        break;
      }
    }

    return lastResult ? streak : -streak; // Positive for wins, negative for losses
  }

  /**
   * Get best win streak
   */
  private getBestStreak(): number {
    if (this.gameHistory.length === 0) {
      return 0;
    }

    let bestStreak = 0;
    let currentStreak = 0;

    for (const result of this.gameHistory) {
      if (result.success) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return bestStreak;
  }



  /**
   * Clear all performance data (for testing or reset)
   */
  clearPerformanceData(): void {
    this.performance = this.createDefaultPerformance();
    this.gameHistory = [];
    
    StatisticsStorage.clearPerformanceData();
  }

  /**
   * Export performance data for backup
   */
  exportPerformanceData(): string | null {
    try {
      const backup = {
        performance: this.performance,
        gameHistory: this.gameHistory.map(result => ({
          ...result,
          timestamp: result.timestamp.toISOString()
        })),
        version: '1.0.0',
        backupTimestamp: new Date().toISOString(),
        backupVersion: '1.0.0'
      };
      
      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Failed to export performance data:', error);
      return null;
    }
  }

  /**
   * Import performance data from backup
   */
  importPerformanceData(data: string): boolean {
    try {
      const backup = JSON.parse(data);
      
      if (!backup.performance || !backup.gameHistory) {
        return false;
      }

      // Convert date strings back to Date objects
      const gameHistory: GameResult[] = backup.gameHistory.map((result: any) => ({
        ...result,
        timestamp: new Date(result.timestamp)
      }));

      // Update current instance
      this.performance = { ...backup.performance };
      this.gameHistory = gameHistory;

      // Also save to storage for persistence
      StatisticsStorage.savePerformanceData(this.performance, this.gameHistory);
      
      return true;
    } catch (error) {
      console.error('Failed to import performance data:', error);
      return false;
    }
  }

  /**
   * Get storage information for performance data
   */
  getStorageInfo(): {
    performanceSize: number;
    historySize: number;
    totalSize: number;
    entryCount: number;
  } {
    return StatisticsStorage.getStorageInfo();
  }

  /**
   * Trim old performance data to free up space
   */
  trimPerformanceData(keepCount: number = 50): boolean {
    const success = StatisticsStorage.trimPerformanceData(keepCount);
    if (success) {
      // Reload data after trimming
      const reloadedData = StatisticsStorage.loadPerformanceData();
      this.performance = reloadedData.performance;
      this.gameHistory = reloadedData.gameHistory;
    }
    return success;
  }

  /**
   * Check if automatic backup is needed
   */
  needsBackup(): boolean {
    return StatisticsStorage.needsBackup();
  }

  /**
   * Update backup timestamp
   */
  updateBackupTimestamp(): void {
    StatisticsStorage.updateBackupTimestamp();
  }
}