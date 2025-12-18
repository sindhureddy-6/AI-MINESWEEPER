/**
 * Performance monitoring service for tracking and optimizing game performance
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  name: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastDuration: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface FrameRateInfo {
  fps: number;
  frameTime: number;
  droppedFrames: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private entries: PerformanceEntry[] = [];
  private activeTimers: Map<string, number> = new Map();
  private stats: Map<string, PerformanceStats> = new Map();
  private frameRateMonitor: FrameRateMonitor | null = null;
  private memoryMonitor: MemoryMonitor | null = null;
  private isEnabled: boolean = true;
  private maxEntries: number = 1000;

  private constructor() {
    this.initializeMonitors();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializeMonitors(): void {
    // Initialize frame rate monitoring
    this.frameRateMonitor = new FrameRateMonitor();
    
    // Initialize memory monitoring if available
    if ('memory' in performance) {
      this.memoryMonitor = new MemoryMonitor();
    }
  }

  /**
   * Start timing a performance measurement
   */
  public startTiming(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const startTime = performance.now();
    this.activeTimers.set(name, startTime);
    
    // Store metadata for later use
    if (metadata) {
      this.activeTimers.set(`${name}_metadata`, metadata as any);
    }
  }

  /**
   * End timing and record the measurement
   */
  public endTiming(name: string): number {
    if (!this.isEnabled) return 0;

    const endTime = performance.now();
    const startTime = this.activeTimers.get(name);
    
    if (startTime === undefined) {
      console.warn(`No start time found for performance measurement: ${name}`);
      return 0;
    }

    const duration = endTime - startTime;
    const metadata = this.activeTimers.get(`${name}_metadata`) as Record<string, any> | undefined;
    
    // Clean up
    this.activeTimers.delete(name);
    if (metadata) {
      this.activeTimers.delete(`${name}_metadata`);
    }

    // Record the entry
    this.recordEntry({
      name,
      startTime,
      endTime,
      duration,
      metadata
    });

    return duration;
  }

  /**
   * Measure a function execution time
   */
  public async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.startTiming(name, metadata);
    try {
      const result = await fn();
      this.endTiming(name);
      return result;
    } catch (error) {
      this.endTiming(name);
      throw error;
    }
  }

  /**
   * Measure a synchronous function execution time
   */
  public measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.startTiming(name, metadata);
    try {
      const result = fn();
      this.endTiming(name);
      return result;
    } catch (error) {
      this.endTiming(name);
      throw error;
    }
  }

  /**
   * Record a performance entry
   */
  private recordEntry(entry: PerformanceEntry): void {
    // Add to entries list
    this.entries.push(entry);
    
    // Maintain max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Update statistics
    this.updateStats(entry);
  }

  /**
   * Update performance statistics
   */
  private updateStats(entry: PerformanceEntry): void {
    const existing = this.stats.get(entry.name);
    
    if (existing) {
      existing.count++;
      existing.totalDuration += entry.duration;
      existing.averageDuration = existing.totalDuration / existing.count;
      existing.minDuration = Math.min(existing.minDuration, entry.duration);
      existing.maxDuration = Math.max(existing.maxDuration, entry.duration);
      existing.lastDuration = entry.duration;
    } else {
      this.stats.set(entry.name, {
        name: entry.name,
        count: 1,
        totalDuration: entry.duration,
        averageDuration: entry.duration,
        minDuration: entry.duration,
        maxDuration: entry.duration,
        lastDuration: entry.duration
      });
    }
  }

  /**
   * Get performance statistics for a specific measurement
   */
  public getStats(name: string): PerformanceStats | null {
    return this.stats.get(name) || null;
  }

  /**
   * Get all performance statistics
   */
  public getAllStats(): PerformanceStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get recent performance entries
   */
  public getRecentEntries(count: number = 50): PerformanceEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entries for a specific measurement name
   */
  public getEntriesForName(name: string, count: number = 50): PerformanceEntry[] {
    return this.entries
      .filter(entry => entry.name === name)
      .slice(-count);
  }

  /**
   * Get current frame rate information
   */
  public getFrameRateInfo(): FrameRateInfo | null {
    return this.frameRateMonitor?.getCurrentInfo() || null;
  }

  /**
   * Get current memory information
   */
  public getMemoryInfo(): MemoryInfo | null {
    return this.memoryMonitor?.getCurrentInfo() || null;
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    measurements: PerformanceStats[];
    frameRate: FrameRateInfo | null;
    memory: MemoryInfo | null;
    totalEntries: number;
  } {
    return {
      measurements: this.getAllStats(),
      frameRate: this.getFrameRateInfo(),
      memory: this.getMemoryInfo(),
      totalEntries: this.entries.length
    };
  }

  /**
   * Clear all performance data
   */
  public clear(): void {
    this.entries = [];
    this.stats.clear();
    this.activeTimers.clear();
  }

  /**
   * Enable or disable performance monitoring
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (this.frameRateMonitor) {
      this.frameRateMonitor.setEnabled(enabled);
    }
    
    if (this.memoryMonitor) {
      this.memoryMonitor.setEnabled(enabled);
    }
  }

  /**
   * Check if performance monitoring is enabled
   */
  public isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set maximum number of entries to keep
   */
  public setMaxEntries(maxEntries: number): void {
    this.maxEntries = maxEntries;
    
    // Trim existing entries if necessary
    if (this.entries.length > maxEntries) {
      this.entries = this.entries.slice(-maxEntries);
    }
  }

  /**
   * Export performance data for analysis
   */
  public exportData(): {
    entries: PerformanceEntry[];
    stats: PerformanceStats[];
    timestamp: number;
  } {
    return {
      entries: [...this.entries],
      stats: this.getAllStats(),
      timestamp: Date.now()
    };
  }

  /**
   * Dispose of the monitor and clean up resources
   */
  public dispose(): void {
    this.clear();
    
    if (this.frameRateMonitor) {
      this.frameRateMonitor.dispose();
      this.frameRateMonitor = null;
    }
    
    if (this.memoryMonitor) {
      this.memoryMonitor.dispose();
      this.memoryMonitor = null;
    }
  }

  /**
   * Dispose of the singleton instance
   */
  public static dispose(): void {
    if (PerformanceMonitor.instance) {
      PerformanceMonitor.instance.dispose();
      PerformanceMonitor.instance = null;
    }
  }
}

/**
 * Frame rate monitoring class
 */
class FrameRateMonitor {
  private fps: number = 0;
  private frameTime: number = 0;
  private droppedFrames: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private startTime: number = 0;
  private animationId: number | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    if (!this.isEnabled) return;

    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    
    const measureFrame = (currentTime: number) => {
      if (!this.isEnabled) return;

      this.frameCount++;
      
      // Calculate frame time
      this.frameTime = currentTime - this.lastFrameTime;
      
      // Detect dropped frames (assuming 60fps target)
      if (this.frameTime > 16.67 * 2) {
        this.droppedFrames++;
      }
      
      // Calculate FPS every second
      const elapsed = currentTime - this.startTime;
      if (elapsed >= 1000) {
        this.fps = (this.frameCount * 1000) / elapsed;
        this.frameCount = 0;
        this.startTime = currentTime;
      }
      
      this.lastFrameTime = currentTime;
      this.animationId = requestAnimationFrame(measureFrame);
    };

    this.animationId = requestAnimationFrame(measureFrame);
  }

  public getCurrentInfo(): FrameRateInfo {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      droppedFrames: this.droppedFrames
    };
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (enabled && !this.animationId) {
      this.startMonitoring();
    } else if (!enabled && this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

/**
 * Memory monitoring class
 */
class MemoryMonitor {
  private isEnabled: boolean = true;
  private intervalId: number | null = null;
  private currentInfo: MemoryInfo | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    if (!this.isEnabled || !('memory' in performance)) return;

    this.updateMemoryInfo();
    
    // Update memory info every 5 seconds
    this.intervalId = setInterval(() => {
      this.updateMemoryInfo();
    }, 5000);
  }

  private updateMemoryInfo(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.currentInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
  }

  public getCurrentInfo(): MemoryInfo | null {
    return this.currentInfo;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (enabled && !this.intervalId) {
      this.startMonitoring();
    } else if (!enabled && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}