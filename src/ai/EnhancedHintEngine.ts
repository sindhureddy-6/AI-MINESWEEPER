/**
 * Enhanced HintEngine with Web Worker support and performance optimization
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { Coordinate, HintAnalysis, Cell } from '../types/index.ts';
import { GameBoard } from '../models/GameBoard.ts';
import { HintEngine } from './HintEngine.ts';
import { AIWorkerManager } from '../services/AIWorkerManager.ts';
import { PerformanceMonitor } from '../services/PerformanceMonitor.ts';

export interface EnhancedHintAnalysis extends HintAnalysis {
  performance?: {
    duration: number;
    memoryUsage?: number;
    usedWorker: boolean;
    queueTime?: number;
    totalTime?: number;
  };
}

export class EnhancedHintEngine {
  private static workerManager: AIWorkerManager | null = null;
  private static performanceMonitor: PerformanceMonitor | null = null;
  private static fallbackToMainThread: boolean = false;
  private static workerTimeoutMs: number = 10000;

  /**
   * Initialize the enhanced hint engine
   */
  public static initialize(): void {
    this.workerManager = AIWorkerManager.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Analyze board with automatic fallback to main thread if worker fails
   */
  public static async analyzeBoard(gameBoard: GameBoard): Promise<EnhancedHintAnalysis> {
    const startTime = performance.now();
    
    // Try Web Worker first if available and not disabled
    if (this.shouldUseWorker()) {
      try {
        const result = await this.analyzeBoardWithWorker(gameBoard);
        return {
          ...result.analysis,
          performance: {
            ...result.performance,
            usedWorker: true
          }
        };
      } catch (error) {
        console.warn('Worker analysis failed, falling back to main thread:', error);
        this.fallbackToMainThread = true;
      }
    }

    // Fallback to main thread
    return this.analyzeBoardOnMainThread(gameBoard, startTime);
  }

  /**
   * Analyze board using Web Worker
   */
  private static async analyzeBoardWithWorker(gameBoard: GameBoard): Promise<{
    analysis: HintAnalysis;
    performance: any;
  }> {
    if (!this.workerManager) {
      throw new Error('Worker manager not initialized');
    }

    const boardData = this.serializeGameBoard(gameBoard);
    return await this.workerManager.analyzeBoard(boardData, this.workerTimeoutMs);
  }

  /**
   * Analyze board on main thread with performance monitoring
   */
  private static analyzeBoardOnMainThread(gameBoard: GameBoard, startTime?: number): EnhancedHintAnalysis {
    const actualStartTime = startTime || performance.now();
    
    let analysis: HintAnalysis;
    
    if (this.performanceMonitor) {
      analysis = this.performanceMonitor.measure('hint-analysis-main-thread', () => {
        return HintEngine.analyzeBoard(gameBoard);
      });
    } else {
      analysis = HintEngine.analyzeBoard(gameBoard);
    }

    const endTime = performance.now();
    const duration = endTime - actualStartTime;

    return {
      ...analysis,
      performance: {
        duration,
        memoryUsage: this.getCurrentMemoryUsage(),
        usedWorker: false
      }
    };
  }

  /**
   * Calculate probabilities only (faster operation)
   */
  public static async calculateProbabilities(gameBoard: GameBoard): Promise<{
    probabilities: Map<Coordinate, number>;
    performance?: any;
  }> {
    if (this.shouldUseWorker()) {
      try {
        const boardData = this.serializeGameBoard(gameBoard);
        return await this.workerManager!.calculateProbabilities(boardData, 5000);
      } catch (error) {
        console.warn('Worker probability calculation failed, falling back to main thread:', error);
      }
    }

    // Fallback to main thread
    const startTime = performance.now();
    const analysis = HintEngine.analyzeBoard(gameBoard);
    const endTime = performance.now();

    return {
      probabilities: analysis.probabilities,
      performance: {
        duration: endTime - startTime,
        usedWorker: false
      }
    };
  }

  /**
   * Find best move only (fastest operation)
   */
  public static async findBestMove(gameBoard: GameBoard): Promise<{
    recommendedMove: Coordinate | null;
    confidence: number;
    performance?: any;
  }> {
    if (this.shouldUseWorker()) {
      try {
        const boardData = this.serializeGameBoard(gameBoard);
        return await this.workerManager!.findBestMove(boardData, 3000);
      } catch (error) {
        console.warn('Worker best move calculation failed, falling back to main thread:', error);
      }
    }

    // Fallback to main thread
    const startTime = performance.now();
    const analysis = HintEngine.analyzeBoard(gameBoard);
    const endTime = performance.now();

    return {
      recommendedMove: analysis.recommendedMove,
      confidence: analysis.confidence,
      performance: {
        duration: endTime - startTime,
        usedWorker: false
      }
    };
  }

  /**
   * Get multiple move suggestions with performance optimization
   */
  public static async getTopMoves(gameBoard: GameBoard, count: number = 3): Promise<{
    moves: Array<{
      coordinate: Coordinate;
      probability: number;
      priority: number;
      reasoning: string;
    }>;
    performance?: any;
  }> {
    const startTime = performance.now();
    
    // This operation is typically fast enough for main thread
    const moves = HintEngine.getTopMoves(gameBoard, count);
    const endTime = performance.now();

    return {
      moves,
      performance: {
        duration: endTime - startTime,
        usedWorker: false
      }
    };
  }

  /**
   * Batch analyze multiple board states (useful for difficulty adaptation)
   */
  public static async batchAnalyze(gameBoards: GameBoard[]): Promise<EnhancedHintAnalysis[]> {
    const results: EnhancedHintAnalysis[] = [];
    
    // Process in parallel if using workers, sequentially if not
    if (this.shouldUseWorker() && gameBoards.length > 1) {
      const promises = gameBoards.map(board => this.analyzeBoard(board));
      return await Promise.all(promises);
    } else {
      // Sequential processing for main thread to avoid blocking
      for (const board of gameBoards) {
        results.push(await this.analyzeBoard(board));
      }
    }

    return results;
  }

  /**
   * Check if we should use Web Worker
   */
  private static shouldUseWorker(): boolean {
    return !this.fallbackToMainThread && 
           this.workerManager !== null && 
           this.workerManager.isWorkerAvailable();
  }

  /**
   * Serialize GameBoard for worker communication
   */
  private static serializeGameBoard(gameBoard: GameBoard): Cell[][] {
    const board: Cell[][] = [];
    
    // Get board dimensions by checking the actual board structure
    let height = 0;
    let width = 0;
    
    // Find dimensions by checking cells
    for (let y = 0; y < 50; y++) { // Max reasonable board size
      for (let x = 0; x < 50; x++) {
        const cell = gameBoard.getCell(x, y);
        if (cell) {
          height = Math.max(height, y + 1);
          width = Math.max(width, x + 1);
        } else {
          break;
        }
      }
    }
    
    for (let y = 0; y < height; y++) {
      board[y] = [];
      for (let x = 0; x < width; x++) {
        const cell = gameBoard.getCell(x, y);
        if (cell) {
          board[y][x] = {
            hasMine: cell.hasMine,
            isRevealed: cell.isRevealed,
            isFlagged: cell.isFlagged,
            adjacentMines: cell.adjacentMines,
            coordinates: { x, y }
          };
        }
      }
    }
    
    return board;
  }

  /**
   * Get current memory usage if available
   */
  private static getCurrentMemoryUsage(): number | undefined {
    if (this.performanceMonitor) {
      const memInfo = this.performanceMonitor.getMemoryInfo();
      return memInfo?.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Get performance statistics
   */
  public static getPerformanceStats(): {
    workerStats?: any;
    mainThreadStats?: any;
    frameRate?: any;
    memory?: any;
  } {
    const stats: any = {};

    if (this.workerManager) {
      stats.workerStats = this.workerManager.getPerformanceStats();
    }

    if (this.performanceMonitor) {
      stats.mainThreadStats = this.performanceMonitor.getStats('hint-analysis-main-thread');
      stats.frameRate = this.performanceMonitor.getFrameRateInfo();
      stats.memory = this.performanceMonitor.getMemoryInfo();
    }

    return stats;
  }

  /**
   * Configure performance settings
   */
  public static configure(options: {
    workerTimeoutMs?: number;
    enableFallback?: boolean;
    enablePerformanceMonitoring?: boolean;
  }): void {
    if (options.workerTimeoutMs !== undefined) {
      this.workerTimeoutMs = options.workerTimeoutMs;
    }

    if (options.enableFallback !== undefined) {
      this.fallbackToMainThread = !options.enableFallback;
    }

    if (options.enablePerformanceMonitoring !== undefined && this.performanceMonitor) {
      this.performanceMonitor.setEnabled(options.enablePerformanceMonitoring);
    }
  }

  /**
   * Warm up the worker (pre-initialize for faster first analysis)
   */
  public static async warmUp(): Promise<void> {
    if (!this.shouldUseWorker()) {
      return;
    }

    try {
      // Create a small test board to warm up the worker
      const testBoard = new GameBoard(3, 3, 1);
      await this.findBestMove(testBoard);
    } catch (error) {
      console.warn('Worker warm-up failed:', error);
    }
  }

  /**
   * Clear performance data and reset state
   */
  public static reset(): void {
    this.fallbackToMainThread = false;
    
    if (this.performanceMonitor) {
      this.performanceMonitor.clear();
    }

    if (this.workerManager) {
      this.workerManager.clearPerformanceMetrics();
    }
  }

  /**
   * Dispose of resources
   */
  public static dispose(): void {
    if (this.workerManager) {
      AIWorkerManager.dispose();
      this.workerManager = null;
    }

    if (this.performanceMonitor) {
      PerformanceMonitor.dispose();
      this.performanceMonitor = null;
    }

    this.reset();
  }
}