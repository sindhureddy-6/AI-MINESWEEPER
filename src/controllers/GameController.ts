import { GameState, DifficultySettings, Coordinate, ClickType, HintAnalysis, GameResult, Cell } from '@/types/index';
import { GameStateManager } from '@/models/GameStateManager';
import { HintEngine } from '@/ai/HintEngine';
import { EnhancedHintEngine } from '@/ai/EnhancedHintEngine';
import { PlayerPerformanceTracker } from '@/models/PlayerPerformanceTracker';
import { DifficultyAdapter } from '@/models/DifficultyAdapter';
import { GameStateStorage } from '@/services/GameStateStorage';
import { OfflineManager } from '@/services/OfflineManager';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';

/**
 * Event types for game controller notifications
 */
export interface GameControllerEvents {
  gameStateChanged: (gameState: GameState) => void;
  cellRevealed: (coordinate: Coordinate, cascaded: boolean) => void;
  cellFlagged: (coordinate: Coordinate, flagged: boolean) => void;
  gameStarted: (difficulty: DifficultySettings) => void;
  gameEnded: (result: GameResult) => void;
  hintGenerated: (hint: HintAnalysis) => void;
  difficultyChanged: (newDifficulty: DifficultySettings) => void;
}

/**
 * GameController orchestrates game flow and coordinates between game logic and UI
 * Requirements: 1.1, 1.2, 1.3, 2.1, 3.4
 */
export class GameController {
  private gameStateManager: GameStateManager;
  private performanceTracker: PlayerPerformanceTracker;
  private difficultyAdapter: DifficultyAdapter;
  private eventListeners: Partial<GameControllerEvents> = {};
  private currentHint: HintAnalysis | null = null;
  private hintsUsedInCurrentGame: number = 0;
  private isHintModeEnabled: boolean = false;
  private autoSaveEnabled: boolean = true;
  private offlineManager: OfflineManager;

  constructor(initialDifficulty: DifficultySettings) {
    this.gameStateManager = new GameStateManager(initialDifficulty);
    this.performanceTracker = new PlayerPerformanceTracker();
    this.difficultyAdapter = new DifficultyAdapter(this.performanceTracker);
    this.offlineManager = OfflineManager.getInstance();
    
    // Initialize enhanced AI engine
    EnhancedHintEngine.initialize();
    
    // Setup offline functionality
    this.setupOfflineSupport();
    
    // Try to load saved game state
    const savedState = GameStateStorage.loadGameState();
    if (savedState && savedState.gameStatus === 'playing') {
      // Restore saved game
      this.restoreGameState(savedState);
    } else {
      // Initialize with adaptive difficulty if performance history exists
      const adaptedDifficulty = this.difficultyAdapter.getRecommendedDifficulty();
      if (adaptedDifficulty && adaptedDifficulty !== initialDifficulty) {
        this.startNewGame(adaptedDifficulty);
      }
    }
    
    // Warm up the AI engine for better performance
    this.warmUpAI();
  }

  /**
   * Register event listener for game events
   */
  addEventListener<K extends keyof GameControllerEvents>(
    event: K,
    listener: GameControllerEvents[K]
  ): void {
    this.eventListeners[event] = listener;
  }

  /**
   * Remove event listener
   */
  removeEventListener<K extends keyof GameControllerEvents>(event: K): void {
    delete this.eventListeners[event];
  }

  /**
   * Emit event to registered listeners
   */
  private emit<K extends keyof GameControllerEvents>(
    event: K,
    ...args: Parameters<GameControllerEvents[K]>
  ): void {
    const listener = this.eventListeners[event];
    if (listener) {
      (listener as any)(...args);
    }
  }

  /**
   * Handle cell click interaction
   * Requirements: 1.1, 1.2, 1.3
   */
  handleCellClick(x: number, y: number, clickType: ClickType): boolean {
    const gameState = this.gameStateManager.getGameState();
    
    // Ignore clicks if game is over
    if (gameState.gameStatus !== 'playing') {
      return false;
    }

    let actionTaken = false;

    switch (clickType) {
      case ClickType.LEFT:
        actionTaken = this.handleLeftClick(x, y);
        break;
      case ClickType.RIGHT:
        actionTaken = this.handleRightClick(x, y);
        break;
      case ClickType.MIDDLE:
        actionTaken = this.handleMiddleClick(x, y);
        break;
    }

    if (actionTaken) {
      // Clear current hint when user makes a move
      this.currentHint = null;
      
      // Auto-save game state
      this.autoSaveGameState();
      
      // Emit game state change
      this.emit('gameStateChanged', this.gameStateManager.getGameState());
      
      // Check if game ended
      if (this.gameStateManager.isGameOver()) {
        this.handleGameEnd();
      }
    }

    return actionTaken;
  }

  /**
   * Handle left click (reveal cell)
   */
  private handleLeftClick(x: number, y: number): boolean {
    const cell = this.gameStateManager.getGameBoard().getCell(x, y);
    if (!cell || cell.isRevealed || cell.isFlagged) {
      return false;
    }

    const wasRevealed = this.gameStateManager.revealCell(x, y);
    if (wasRevealed) {
      // Determine if this was a cascaded reveal
      const cascaded = cell.adjacentMines === 0;
      this.emit('cellRevealed', { x, y }, cascaded);
    }

    return wasRevealed;
  }

  /**
   * Handle right click (toggle flag)
   */
  private handleRightClick(x: number, y: number): boolean {
    const cell = this.gameStateManager.getGameBoard().getCell(x, y);
    if (!cell || cell.isRevealed) {
      return false;
    }

    const wasFlagged = cell.isFlagged;
    const flagToggled = this.gameStateManager.toggleFlag(x, y);
    
    if (flagToggled) {
      this.emit('cellFlagged', { x, y }, !wasFlagged);
    }

    return flagToggled;
  }

  /**
   * Handle middle click (chord click - reveal adjacent if flag count matches)
   */
  private handleMiddleClick(x: number, y: number): boolean {
    const cell = this.gameStateManager.getGameBoard().getCell(x, y);
    if (!cell || !cell.isRevealed) {
      return false;
    }

    const gameBoard = this.gameStateManager.getGameBoard();
    const adjacentCells = gameBoard.getAdjacentCells(x, y);
    const flaggedCount = adjacentCells.filter((c: Cell) => c.isFlagged).length;

    // Only chord if flag count matches adjacent mine count
    if (flaggedCount !== cell.adjacentMines) {
      return false;
    }

    let anyRevealed = false;
    adjacentCells.forEach((adjCell: Cell) => {
      if (!adjCell.isRevealed && !adjCell.isFlagged) {
        const revealed = this.gameStateManager.revealCell(
          adjCell.coordinates.x,
          adjCell.coordinates.y
        );
        if (revealed) {
          anyRevealed = true;
          this.emit('cellRevealed', adjCell.coordinates, false);
        }
      }
    });

    return anyRevealed;
  }

  /**
   * Request AI hint for current board state
   * Requirements: 2.1
   */
  async requestHint(): Promise<HintAnalysis | null> {
    const gameState = this.gameStateManager.getGameState();
    
    if (gameState.gameStatus !== 'playing') {
      return null;
    }

    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      
      const enhancedHint = await performanceMonitor.measureAsync(
        'hint-generation',
        () => EnhancedHintEngine.analyzeBoard(this.gameStateManager.getGameBoard()),
        { gameStatus: gameState.gameStatus, hintsUsed: this.hintsUsedInCurrentGame }
      );
      
      // Convert enhanced hint to regular hint for compatibility
      const hint: HintAnalysis = {
        guaranteedSafe: enhancedHint.guaranteedSafe,
        guaranteedMines: enhancedHint.guaranteedMines,
        probabilities: enhancedHint.probabilities,
        recommendedMove: enhancedHint.recommendedMove,
        confidence: enhancedHint.confidence
      };
      
      this.currentHint = hint;
      this.hintsUsedInCurrentGame++;
      
      // Log performance metrics
      if (enhancedHint.performance) {
        console.log('Hint generation performance:', enhancedHint.performance);
      }
      
      this.emit('hintGenerated', hint);
      return hint;
    } catch (error) {
      console.error('Error generating hint:', error);
      
      // Fallback to synchronous hint generation
      try {
        const fallbackHint = HintEngine.analyzeBoard(this.gameStateManager.getGameBoard());
        this.currentHint = fallbackHint;
        this.hintsUsedInCurrentGame++;
        this.emit('hintGenerated', fallbackHint);
        return fallbackHint;
      } catch (fallbackError) {
        console.error('Fallback hint generation also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Get current hint without generating a new one
   */
  getCurrentHint(): HintAnalysis | null {
    return this.currentHint;
  }

  /**
   * Toggle hint mode display
   */
  toggleHintMode(): boolean {
    this.isHintModeEnabled = !this.isHintModeEnabled;
    return this.isHintModeEnabled;
  }

  /**
   * Check if hint mode is enabled
   */
  isHintModeActive(): boolean {
    return this.isHintModeEnabled;
  }

  /**
   * Start a new game with specified difficulty
   */
  startNewGame(difficulty: DifficultySettings): void {
    // Record current game result if game was in progress
    if (this.gameStateManager.getGameState().gameStatus === 'playing') {
      this.recordGameResult(false); // Treat as abandonment/loss
    }

    this.gameStateManager.newGame(difficulty);
    this.currentHint = null;
    this.hintsUsedInCurrentGame = 0;
    this.isHintModeEnabled = false;

    // Auto-save new game state
    this.autoSaveGameState();

    this.emit('gameStarted', difficulty);
    this.emit('gameStateChanged', this.gameStateManager.getGameState());
  }

  /**
   * Restart current game with same difficulty
   */
  restartGame(): void {
    const currentDifficulty = this.gameStateManager.getGameState().difficulty;
    this.startNewGame(currentDifficulty);
  }



  /**
   * Record game result for performance tracking
   */
  private recordGameResult(success: boolean): void {
    const gameState = this.gameStateManager.getGameState();
    const duration = this.gameStateManager.getGameDuration();

    const result: GameResult = {
      success,
      duration,
      hintsUsed: this.hintsUsedInCurrentGame,
      difficulty: gameState.difficulty,
      timestamp: new Date()
    };

    this.performanceTracker.recordGame(result);
    this.emit('gameEnded', result);
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.gameStateManager.getGameState();
  }

  /**
   * Get player performance statistics
   */
  getPerformanceStats() {
    return this.performanceTracker.getPerformance();
  }

  /**
   * Set manual difficulty (disables adaptive difficulty)
   * Requirements: 3.4
   */
  setManualDifficulty(difficulty: DifficultySettings): void {
    this.difficultyAdapter.setManualDifficulty(difficulty);
    this.startNewGame(difficulty);
  }

  /**
   * Enable adaptive difficulty
   */
  enableAdaptiveDifficulty(): void {
    this.difficultyAdapter.enableAutomaticAdaptation();
    
    const recommendedDifficulty = this.difficultyAdapter.getRecommendedDifficulty();
    if (recommendedDifficulty) {
      this.emit('difficultyChanged', recommendedDifficulty);
    }
  }

  /**
   * Check if adaptive difficulty is enabled
   */
  isAdaptiveDifficultyEnabled(): boolean {
    return this.difficultyAdapter.isAdaptationEnabled();
  }

  /**
   * Get game session statistics
   */
  getSessionStats(): {
    gamesPlayed: number;
    winRate: number;
    averageTime: number;
    hintsUsed: number;
    currentStreak: number;
  } {
    const performance = this.performanceTracker.getPerformance();
    
    return {
      gamesPlayed: performance.gamesPlayed,
      winRate: performance.winRate,
      averageTime: performance.averageTime,
      hintsUsed: this.hintsUsedInCurrentGame,
      currentStreak: this.performanceTracker.getCurrentStreak()
    };
  }

  /**
   * Validate current game state
   */
  validateGameState(): boolean {
    return this.gameStateManager.validateGameState();
  }

  /**
   * Get remaining mine count
   */
  getRemainingMineCount(): number {
    return this.gameStateManager.getRemainingMineCount();
  }

  /**
   * Get game duration in milliseconds
   */
  getGameDuration(): number {
    return this.gameStateManager.getGameDuration();
  }

  /**
   * Check if first click has been made
   */
  isFirstClick(): boolean {
    return this.gameStateManager.getGameState().revealedCount === 0;
  }

  /**
   * Setup offline support and connectivity monitoring
   */
  private setupOfflineSupport(): void {
    // Prepare for offline usage
    this.offlineManager.prepareForOffline();
    
    // Listen for connectivity changes
    this.offlineManager.addConnectivityListener((isOnline: boolean) => {
      this.handleConnectivityChange(isOnline);
    });
    
    // Enable graceful degradation if currently offline
    if (this.offlineManager.isOffline()) {
      this.offlineManager.enableGracefulDegradation();
    }
  }

  /**
   * Handle connectivity state changes
   */
  private handleConnectivityChange(isOnline: boolean): void {
    this.offlineManager.handleConnectivityChange(isOnline);
    
    if (isOnline) {
      // Back online - could sync data if we had cloud features
      console.log('Game back online - all features available');
    } else {
      // Gone offline - ensure local functionality works
      console.log('Game offline - using local storage only');
    }
    
    // Emit connectivity change event
    this.emit('gameStateChanged', this.gameStateManager.getGameState());
  }

  /**
   * Auto-save current game state if enabled
   */
  private autoSaveGameState(): void {
    if (!this.autoSaveEnabled) {
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    
    // Only save if game is in progress
    if (gameState.gameStatus === 'playing') {
      GameStateStorage.saveGameState(gameState);
    } else {
      // Clear saved state when game ends
      GameStateStorage.clearGameState();
    }
  }

  /**
   * Restore game state from saved data
   */
  private restoreGameState(savedState: GameState): boolean {
    try {
      // Validate the saved state
      if (!GameStateStorage.validateGameState(savedState)) {
        return false;
      }

      // Create new game state manager with restored state
      this.gameStateManager = new GameStateManager(savedState.difficulty);
      
      // We need to restore the internal state - this requires extending GameStateManager
      // For now, we'll start a new game and let the user know there was a saved game
      console.log('Found saved game state, but restoration requires additional implementation');
      
      return false;
    } catch (error) {
      console.error('Failed to restore game state:', error);
      return false;
    }
  }

  /**
   * Enable or disable auto-save functionality
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
    
    if (!enabled) {
      // Clear saved state when disabling auto-save
      GameStateStorage.clearGameState();
    }
  }

  /**
   * Check if auto-save is enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveEnabled;
  }

  /**
   * Check if there is a saved game available
   */
  hasSavedGame(): boolean {
    return GameStateStorage.hasSavedGameState();
  }

  /**
   * Load saved game if available
   */
  loadSavedGame(): boolean {
    const savedState = GameStateStorage.loadGameState();
    if (!savedState || savedState.gameStatus !== 'playing') {
      return false;
    }

    return this.restoreGameState(savedState);
  }

  /**
   * Clear any saved game data
   */
  clearSavedGame(): void {
    GameStateStorage.clearGameState();
  }

  /**
   * Get storage information
   */
  getStorageInfo(): {
    used: number;
    available: number;
    gameStateSize: number;
  } {
    return GameStateStorage.getStorageInfo();
  }

  /**
   * Create backup of current game
   */
  createGameBackup(): string | null {
    return GameStateStorage.createBackup();
  }

  /**
   * Restore game from backup data
   */
  restoreFromBackup(backupData: string): boolean {
    const success = GameStateStorage.restoreFromBackup(backupData);
    if (success) {
      // Reload the restored game
      const restoredState = GameStateStorage.loadGameState();
      if (restoredState) {
        this.restoreGameState(restoredState);
      }
    }
    return success;
  }

  /**
   * Handle game end with persistence cleanup
   */
  private handleGameEnd(): void {
    const gameState = this.gameStateManager.getGameState();
    const success = gameState.gameStatus === 'won';
    
    this.recordGameResult(success);
    
    // Clear saved game state since game is complete
    GameStateStorage.clearGameState();
    
    // Update difficulty based on performance
    const newDifficulty = this.difficultyAdapter.getRecommendedDifficulty();
    if (newDifficulty && newDifficulty !== gameState.difficulty) {
      this.emit('difficultyChanged', newDifficulty);
    }
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.offlineManager.isOnlineNow();
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.offlineManager.isOffline();
  }

  /**
   * Get offline capabilities
   */
  getOfflineCapabilities(): {
    isOffline: boolean;
    localStorageAvailable: boolean;
    offlineFeatures: string[];
    networkFeatures: string[];
  } {
    return this.offlineManager.getOfflineCapabilities();
  }

  /**
   * Get network information
   */
  getNetworkInfo(): {
    isOnline: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    return this.offlineManager.getNetworkInfo();
  }

  /**
   * Check if a feature is available offline
   */
  isFeatureAvailableOffline(feature: string): boolean {
    return this.offlineManager.isFeatureAvailableOffline(feature);
  }

  /**
   * Prepare game for offline usage
   */
  prepareForOffline(): void {
    this.offlineManager.prepareForOffline();
  }

  /**
   * Warm up AI engine for better performance
   */
  private async warmUpAI(): Promise<void> {
    try {
      await EnhancedHintEngine.warmUp();
    } catch (error) {
      console.warn('AI warm-up failed:', error);
    }
  }

  /**
   * Get AI performance statistics
   */
  getAIPerformanceStats(): any {
    return EnhancedHintEngine.getPerformanceStats();
  }

  /**
   * Configure AI performance settings
   */
  configureAIPerformance(options: {
    workerTimeoutMs?: number;
    enableFallback?: boolean;
    enablePerformanceMonitoring?: boolean;
  }): void {
    EnhancedHintEngine.configure(options);
  }

  /**
   * Get overall performance summary
   */
  getPerformanceSummary(): any {
    const performanceMonitor = PerformanceMonitor.getInstance();
    return performanceMonitor.getPerformanceSummary();
  }

  /**
   * Dispose of resources and cleanup
   */
  dispose(): void {
    this.eventListeners = {};
    this.currentHint = null;
    
    // Clear any saved state on disposal
    if (this.autoSaveEnabled) {
      GameStateStorage.clearGameState();
    }
    
    // Cleanup offline manager
    this.offlineManager.dispose();
    
    // Cleanup AI engine
    EnhancedHintEngine.dispose();
  }
}