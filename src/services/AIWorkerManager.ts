/**
 * Manager for AI Web Worker to handle non-blocking AI calculations
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { Cell, HintAnalysis, Coordinate } from '../types/index';

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

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: number;
  startTime: number;
}

export interface AIWorkerPerformance {
  duration: number;
  memoryUsage?: number;
  queueTime: number;
  totalTime: number;
}

export class AIWorkerManager {
  private static instance: AIWorkerManager | null = null;
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter: number = 0;
  private isWorkerReady: boolean = false;
  private workerQueue: Array<() => void> = [];
  private performanceMetrics: Map<string, AIWorkerPerformance> = new Map();

  private constructor() {
    this.initializeWorker();
  }

  public static getInstance(): AIWorkerManager {
    if (!AIWorkerManager.instance) {
      AIWorkerManager.instance = new AIWorkerManager();
    }
    return AIWorkerManager.instance;
  }

  private initializeWorker(): void {
    try {
      // Check if Web Workers are supported
      if (typeof Worker === 'undefined') {
        console.warn('Web Workers not supported, falling back to main thread');
        return;
      }

      // Create worker from the TypeScript file
      // In production, this would be the compiled JavaScript
      this.worker = new Worker(
        new URL('../workers/aiWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.worker.addEventListener('error', this.handleWorkerError.bind(this));
      
      // Set up worker timeout
      setTimeout(() => {
        if (!this.isWorkerReady) {
          console.warn('Worker initialization timeout, falling back to main thread');
          this.cleanup();
        }
      }, 5000);

    } catch (error) {
      console.warn('Failed to initialize AI worker:', error);
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, type, payload } = event.data;

    if (type === 'WORKER_READY') {
      this.isWorkerReady = true;
      this.processQueue();
      return;
    }

    const request = this.pendingRequests.get(id);
    if (!request) {
      return;
    }

    // Clear timeout
    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);

    // Calculate total performance metrics
    const endTime = performance.now();
    const totalTime = endTime - request.startTime;
    const queueTime = payload.performance?.startTime ? 
      payload.performance.startTime - request.startTime : 0;

    const performanceMetrics: AIWorkerPerformance = {
      duration: payload.performance?.duration || 0,
      memoryUsage: payload.performance?.memoryUsage,
      queueTime,
      totalTime
    };

    this.performanceMetrics.set(id, performanceMetrics);

    if (type === 'ERROR') {
      request.reject(new Error(payload.error));
    } else {
      // Deserialize analysis if present
      if (payload.analysis) {
        payload.analysis = this.deserializeAnalysis(payload.analysis);
      }
      
      request.resolve({
        ...payload,
        performance: performanceMetrics
      });
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('AI Worker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Worker error: ' + error.message));
    });
    
    this.pendingRequests.clear();
    this.cleanup();
  }

  private processQueue(): void {
    while (this.workerQueue.length > 0 && this.isWorkerReady) {
      const queuedRequest = this.workerQueue.shift();
      if (queuedRequest) {
        queuedRequest();
      }
    }
  }

  private generateRequestId(): string {
    return `ai-request-${++this.requestCounter}-${Date.now()}`;
  }

  private sendWorkerMessage(message: WorkerMessage, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.isWorkerReady) {
        // Queue the request if worker is not ready
        if (this.worker && !this.isWorkerReady) {
          this.workerQueue.push(() => {
            this.sendWorkerMessage(message, timeoutMs).then(resolve).catch(reject);
          });
          return;
        }
        
        // No worker available, reject immediately
        reject(new Error('AI Worker not available'));
        return;
      }

      const startTime = performance.now();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('AI calculation timeout'));
      }, timeoutMs);

      // Store request
      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout,
        startTime
      });

      // Send message to worker
      this.worker.postMessage(message);
    });
  }

  /**
   * Analyze board state using Web Worker
   */
  public async analyzeBoard(boardData: Cell[][], timeoutMs: number = 10000): Promise<{
    analysis: HintAnalysis;
    performance: AIWorkerPerformance;
  }> {
    const id = this.generateRequestId();
    
    const message: WorkerMessage = {
      id,
      type: 'ANALYZE_BOARD',
      payload: { boardData: this.serializeBoardData(boardData) }
    };

    return this.sendWorkerMessage(message, timeoutMs);
  }

  /**
   * Calculate probabilities only using Web Worker
   */
  public async calculateProbabilities(boardData: Cell[][], timeoutMs: number = 5000): Promise<{
    probabilities: Map<Coordinate, number>;
    performance: AIWorkerPerformance;
  }> {
    const id = this.generateRequestId();
    
    const message: WorkerMessage = {
      id,
      type: 'CALCULATE_PROBABILITIES',
      payload: { boardData: this.serializeBoardData(boardData) }
    };

    const result = await this.sendWorkerMessage(message, timeoutMs);
    
    return {
      probabilities: this.deserializeProbabilities(result.probabilities),
      performance: result.performance
    };
  }

  /**
   * Find best move only using Web Worker
   */
  public async findBestMove(boardData: Cell[][], timeoutMs: number = 3000): Promise<{
    recommendedMove: Coordinate | null;
    confidence: number;
    performance: AIWorkerPerformance;
  }> {
    const id = this.generateRequestId();
    
    const message: WorkerMessage = {
      id,
      type: 'FIND_BEST_MOVE',
      payload: { boardData: this.serializeBoardData(boardData) }
    };

    return this.sendWorkerMessage(message, timeoutMs);
  }

  /**
   * Check if Web Worker is available and ready
   */
  public isWorkerAvailable(): boolean {
    return this.worker !== null && this.isWorkerReady;
  }

  /**
   * Get performance metrics for a request
   */
  public getPerformanceMetrics(requestId: string): AIWorkerPerformance | null {
    return this.performanceMetrics.get(requestId) || null;
  }

  /**
   * Get overall performance statistics
   */
  public getPerformanceStats(): {
    totalRequests: number;
    averageDuration: number;
    averageQueueTime: number;
    averageTotalTime: number;
  } {
    const metrics = Array.from(this.performanceMetrics.values());
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageDuration: 0,
        averageQueueTime: 0,
        averageTotalTime: 0
      };
    }

    return {
      totalRequests: metrics.length,
      averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      averageQueueTime: metrics.reduce((sum, m) => sum + m.queueTime, 0) / metrics.length,
      averageTotalTime: metrics.reduce((sum, m) => sum + m.totalTime, 0) / metrics.length
    };
  }

  /**
   * Clear performance metrics to prevent memory leaks
   */
  public clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
  }

  private serializeBoardData(boardData: Cell[][]): Cell[][] {
    // Deep clone to avoid reference issues
    return boardData.map(row => 
      row.map(cell => ({
        hasMine: cell.hasMine,
        isRevealed: cell.isRevealed,
        isFlagged: cell.isFlagged,
        adjacentMines: cell.adjacentMines,
        coordinates: { ...cell.coordinates }
      }))
    );
  }

  private deserializeAnalysis(serializedAnalysis: any): HintAnalysis {
    return {
      guaranteedSafe: serializedAnalysis.guaranteedSafe,
      guaranteedMines: serializedAnalysis.guaranteedMines,
      probabilities: this.deserializeProbabilities(serializedAnalysis.probabilities),
      recommendedMove: serializedAnalysis.recommendedMove,
      confidence: serializedAnalysis.confidence
    };
  }

  private deserializeProbabilities(serializedProbabilities: Array<[Coordinate, number]>): Map<Coordinate, number> {
    return new Map(serializedProbabilities);
  }

  /**
   * Cleanup worker and resources
   */
  public cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isWorkerReady = false;
    this.workerQueue = [];
    
    // Reject all pending requests
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Worker terminated'));
    });
    
    this.pendingRequests.clear();
  }

  /**
   * Dispose of the singleton instance
   */
  public static dispose(): void {
    if (AIWorkerManager.instance) {
      AIWorkerManager.instance.cleanup();
      AIWorkerManager.instance = null;
    }
  }
}