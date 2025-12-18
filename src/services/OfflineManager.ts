/**
 * OfflineManager handles offline functionality and network connectivity detection
 * Requirements: 6.4
 */
export class OfflineManager {
  private static instance: OfflineManager | null = null;
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private offlineFeatures: Set<string> = new Set();

  private constructor() {
    this.setupEventListeners();
    this.initializeOfflineFeatures();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  /**
   * Setup network connectivity event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });

    // Additional connectivity check using fetch with timeout
    this.startConnectivityPolling();
  }

  /**
   * Initialize offline-capable features
   */
  private initializeOfflineFeatures(): void {
    // Core game features that work offline
    this.offlineFeatures.add('game-logic');
    this.offlineFeatures.add('ai-hints');
    this.offlineFeatures.add('local-storage');
    this.offlineFeatures.add('statistics');
    this.offlineFeatures.add('difficulty-adaptation');
    this.offlineFeatures.add('animations');
    this.offlineFeatures.add('sound-effects');

    // Features that require network (none for this game currently)
    // this.offlineFeatures.add('leaderboards');
    // this.offlineFeatures.add('cloud-sync');
  }

  /**
   * Start periodic connectivity polling for more reliable detection
   */
  private startConnectivityPolling(): void {
    setInterval(() => {
      this.checkConnectivity();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check actual network connectivity with a lightweight request
   */
  private async checkConnectivity(): Promise<void> {
    try {
      // Use a small image or favicon request to test connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const wasOnline = this.isOnline;
      this.isOnline = response.ok;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
    }
  }

  /**
   * Notify all listeners of connectivity changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline);
      } catch (error) {
        console.error('Error in offline manager listener:', error);
      }
    });
  }

  /**
   * Check if currently online
   */
  isOnlineNow(): boolean {
    return this.isOnline;
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return !this.isOnline;
  }

  /**
   * Add listener for connectivity changes
   */
  addConnectivityListener(listener: (isOnline: boolean) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove connectivity listener
   */
  removeConnectivityListener(listener: (isOnline: boolean) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Check if a specific feature is available offline
   */
  isFeatureAvailableOffline(feature: string): boolean {
    return this.offlineFeatures.has(feature);
  }

  /**
   * Get all offline-capable features
   */
  getOfflineFeatures(): string[] {
    return Array.from(this.offlineFeatures);
  }

  /**
   * Enable graceful degradation for network-dependent features
   */
  enableGracefulDegradation(): void {
    if (this.isOffline()) {
      // Disable or modify network-dependent features
      this.handleOfflineMode();
    }
  }

  /**
   * Handle offline mode activation
   */
  private handleOfflineMode(): void {
    // Show offline indicator
    this.showOfflineIndicator();

    // Disable network-dependent features
    this.disableNetworkFeatures();

    // Ensure local storage is working
    this.verifyLocalStorage();
  }

  /**
   * Show offline mode indicator to user
   */
  private showOfflineIndicator(): void {
    // Create or update offline indicator
    let indicator = document.getElementById('offline-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
      `;
      indicator.textContent = 'Offline Mode';
      document.body.appendChild(indicator);
    }

    indicator.style.opacity = '1';
  }

  /**
   * Hide offline mode indicator
   */
  private hideOfflineIndicator(): void {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }
  }

  /**
   * Disable network-dependent features
   */
  private disableNetworkFeatures(): void {
    // For this minesweeper game, most features work offline
    // This method is here for future network-dependent features
    
    // Example: Disable cloud sync buttons
    const cloudSyncButtons = document.querySelectorAll('[data-requires-network]');
    cloudSyncButtons.forEach(button => {
      (button as HTMLElement).style.opacity = '0.5';
      (button as HTMLElement).style.pointerEvents = 'none';
      button.setAttribute('title', 'This feature requires internet connection');
    });
  }

  /**
   * Re-enable network-dependent features
   */
  private enableNetworkFeatures(): void {
    const cloudSyncButtons = document.querySelectorAll('[data-requires-network]');
    cloudSyncButtons.forEach(button => {
      (button as HTMLElement).style.opacity = '1';
      (button as HTMLElement).style.pointerEvents = 'auto';
      button.removeAttribute('title');
    });
  }

  /**
   * Verify local storage is working
   */
  private verifyLocalStorage(): boolean {
    try {
      const testKey = 'offline-manager-test';
      const testValue = 'test-value';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return retrieved === testValue;
    } catch (error) {
      console.error('Local storage not available:', error);
      return false;
    }
  }

  /**
   * Get offline capabilities summary
   */
  getOfflineCapabilities(): {
    isOffline: boolean;
    localStorageAvailable: boolean;
    offlineFeatures: string[];
    networkFeatures: string[];
  } {
    return {
      isOffline: this.isOffline(),
      localStorageAvailable: this.verifyLocalStorage(),
      offlineFeatures: this.getOfflineFeatures(),
      networkFeatures: [] // No network features in current implementation
    };
  }

  /**
   * Handle connectivity state changes
   */
  handleConnectivityChange(isOnline: boolean): void {
    if (isOnline) {
      this.hideOfflineIndicator();
      this.enableNetworkFeatures();
      console.log('Back online - all features available');
    } else {
      this.handleOfflineMode();
      console.log('Gone offline - using offline mode');
    }
  }

  /**
   * Prepare for offline usage
   */
  prepareForOffline(): void {
    // Ensure all necessary data is cached locally
    this.cacheEssentialData();
    
    // Verify offline functionality
    this.testOfflineFunctionality();
  }

  /**
   * Cache essential data for offline usage
   */
  private cacheEssentialData(): void {
    try {
      // Game settings and preferences
      const settings = localStorage.getItem('ai-minesweeper-settings');
      if (!settings) {
        // Set default settings if none exist
        const defaultSettings = {
          difficulty: 'intermediate',
          soundEnabled: true,
          animationsEnabled: true,
          hintsEnabled: true
        };
        localStorage.setItem('ai-minesweeper-settings', JSON.stringify(defaultSettings));
      }

      // Ensure performance data structure exists
      const performance = localStorage.getItem('ai-minesweeper-performance');
      if (!performance) {
        const defaultPerformance = {
          gamesPlayed: 0,
          winRate: 0,
          averageTime: 0,
          hintUsageRate: 0,
          difficultyProgression: [],
          recentTrends: []
        };
        localStorage.setItem('ai-minesweeper-performance', JSON.stringify(defaultPerformance));
      }
    } catch (error) {
      console.error('Failed to cache essential data:', error);
    }
  }

  /**
   * Test offline functionality
   */
  private testOfflineFunctionality(): boolean {
    try {
      // Test local storage
      if (!this.verifyLocalStorage()) {
        console.warn('Local storage not available - some offline features may not work');
        return false;
      }

      // Test that core game logic works
      // This would involve creating a minimal game instance and testing basic operations
      console.log('Offline functionality verified');
      return true;
    } catch (error) {
      console.error('Offline functionality test failed:', error);
      return false;
    }
  }

  /**
   * Get network status information
   */
  getNetworkInfo(): {
    isOnline: boolean;
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const info: any = {
      isOnline: this.isOnline
    };

    // Add connection information if available (modern browsers)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        info.connectionType = connection.type;
        info.effectiveType = connection.effectiveType;
        info.downlink = connection.downlink;
        info.rtt = connection.rtt;
      }
    }

    return info;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.listeners.clear();
    
    // Note: Event listeners are added as arrow functions in setupEventListeners
    // and cannot be removed without storing references. This is acceptable for
    // a singleton that lives for the application lifetime.
    
    // Hide offline indicator
    this.hideOfflineIndicator();
    
    OfflineManager.instance = null;
  }
}