/**
 * Web Worker for AI calculations to prevent UI blocking
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { HintEngine } from '../ai/HintEngine.ts';
import { GameBoard } from '../models/GameBoard.ts';
import { Cell, HintAnalysis, Coordinate } from '../types/index.ts';

// Message types for worker communication
interface WorkerMessage {
  id: string;
  type: 'ANALYZE_BOARD' | 'CALCULATE_PROBABILITIES' | 'FIND_BEST_MOVE';
  payload: any;
}

interface WorkerResponse {
  id: string;
  type: 'ANALYSIS_COMPLETE' | 'ERROR' | 'WORKER_READY';
  payload: any;
}

// Performance monitoring
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: number;
}

class AIWorker {
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    // Listen for messages from main thread
    self.addEventListener('message', this.handleMessage.bind(this));
    
    // Send ready signal
    this.postMessage({
      id: 'init',
      type: 'WORKER_READY',
      payload: { timestamp: Date.now() }
    });
  }

  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { id, type, payload } = event.data;
    
    try {
      this.startPerformanceTracking(id);
      
      switch (type) {
        case 'ANALYZE_BOARD':
          this.analyzeBoardAsync(id, payload);
          break;
        case 'CALCULATE_PROBABILITIES':
          this.calculateProbabilitiesAsync(id, payload);
          break;
        case 'FIND_BEST_MOVE':
          this.findBestMoveAsync(id, payload);
          break;
        default:
          this.postError(id, `Unknown message type: ${type}`);
      }
    } catch (error) {
      this.postError(id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async analyzeBoardAsync(id: string, payload: { boardData: Cell[][] }): Promise<void> {
    try {
      // Reconstruct GameBoard from serialized data
      const gameBoard = this.reconstructGameBoard(payload.boardData);
      
      // Perform AI analysis
      const analysis = await this.performAnalysisWithTimeout(gameBoard, 5000);
      
      this.endPerformanceTracking(id);
      
      // Send result back to main thread
      this.postMessage({
        id,
        type: 'ANALYSIS_COMPLETE',
        payload: {
          analysis: this.serializeAnalysis(analysis),
          performance: this.performanceMetrics.get(id)
        }
      });
    } catch (error) {
      this.postError(id, error instanceof Error ? error.message : 'Analysis failed');
    }
  }

  private async calculateProbabilitiesAsync(id: string, payload: { boardData: Cell[][] }): Promise<void> {
    try {
      const gameBoard = this.reconstructGameBoard(payload.boardData);
      
      // Calculate probabilities only
      const analysis = HintEngine.analyzeBoard(gameBoard);
      const probabilities = this.serializeProbabilities(analysis.probabilities);
      
      this.endPerformanceTracking(id);
      
      this.postMessage({
        id,
        type: 'ANALYSIS_COMPLETE',
        payload: {
          probabilities,
          performance: this.performanceMetrics.get(id)
        }
      });
    } catch (error) {
      this.postError(id, error instanceof Error ? error.message : 'Probability calculation failed');
    }
  }

  private async findBestMoveAsync(id: string, payload: { boardData: Cell[][] }): Promise<void> {
    try {
      const gameBoard = this.reconstructGameBoard(payload.boardData);
      
      // Find best move only
      const analysis = HintEngine.analyzeBoard(gameBoard);
      
      this.endPerformanceTracking(id);
      
      this.postMessage({
        id,
        type: 'ANALYSIS_COMPLETE',
        payload: {
          recommendedMove: analysis.recommendedMove,
          confidence: analysis.confidence,
          performance: this.performanceMetrics.get(id)
        }
      });
    } catch (error) {
      this.postError(id, error instanceof Error ? error.message : 'Best move calculation failed');
    }
  }

  private async performAnalysisWithTimeout(gameBoard: GameBoard, timeoutMs: number): Promise<HintAnalysis> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Analysis timeout'));
      }, timeoutMs);

      try {
        const analysis = HintEngine.analyzeBoard(gameBoard);
        clearTimeout(timeout);
        resolve(analysis);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private reconstructGameBoard(boardData: Cell[][]): GameBoard {
    // Create a new GameBoard instance from serialized data
    const height = boardData.length;
    const width = boardData[0]?.length || 0;
    const mineCount = boardData.flat().filter(cell => cell.hasMine).length;
    
    const gameBoard = new GameBoard(width, height, mineCount);
    
    // Restore cell states
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellData = boardData[y][x];
        const cell = gameBoard.getCell(x, y);
        
        if (cell) {
          cell.hasMine = cellData.hasMine;
          cell.isRevealed = cellData.isRevealed;
          cell.isFlagged = cellData.isFlagged;
          cell.adjacentMines = cellData.adjacentMines;
        }
      }
    }
    
    return gameBoard;
  }

  private serializeAnalysis(analysis: HintAnalysis): any {
    return {
      guaranteedSafe: analysis.guaranteedSafe,
      guaranteedMines: analysis.guaranteedMines,
      probabilities: this.serializeProbabilities(analysis.probabilities),
      recommendedMove: analysis.recommendedMove,
      confidence: analysis.confidence
    };
  }

  private serializeProbabilities(probabilities: Map<Coordinate, number>): Array<[Coordinate, number]> {
    return Array.from(probabilities.entries());
  }

  private startPerformanceTracking(id: string): void {
    const metrics: PerformanceMetrics = {
      startTime: performance.now(),
      endTime: 0,
      duration: 0
    };
    
    // Track memory usage if available
    if ('memory' in performance) {
      metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
    
    this.performanceMetrics.set(id, metrics);
  }

  private endPerformanceTracking(id: string): void {
    const metrics = this.performanceMetrics.get(id);
    if (metrics) {
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - metrics.startTime;
    }
  }

  private postMessage(response: WorkerResponse): void {
    self.postMessage(response);
  }

  private postError(id: string, message: string): void {
    this.endPerformanceTracking(id);
    
    this.postMessage({
      id,
      type: 'ERROR',
      payload: {
        error: message,
        performance: this.performanceMetrics.get(id)
      }
    });
  }
}

// Initialize worker
new AIWorker();

// Export for TypeScript
export {};