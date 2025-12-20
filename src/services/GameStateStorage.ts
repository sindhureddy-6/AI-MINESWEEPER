import { GameState, DifficultySettings } from '../types/index';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Serializable game state for storage
 */
interface SerializableGameState {
  board: {
    hasMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    adjacentMines: number;
    coordinates: { x: number; y: number };
  }[][];
  gameStatus: 'playing' | 'won' | 'lost';
  startTime: string; // ISO string
  flagCount: number;
  revealedCount: number;
  difficulty: DifficultySettings;
  version: string; // For data migration
}

/**
 * GameStateStorage handles persistence of game state to local storage
 * Requirements: 6.5
 */
export class GameStateStorage {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

  /**
   * Save game state to local storage
   * @param gameState Current game state to save
   * @returns True if save was successful
   */
  static saveGameState(gameState: GameState): boolean {
    try {
      const serializable = this.serializeGameState(gameState);
      const serialized = JSON.stringify(serializable);
      
      // Check storage size before saving
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('Game state too large for storage');
        return false;
      }

      localStorage.setItem(STORAGE_KEYS.GAME_STATE, serialized);
      return true;
    } catch (error) {
      console.error('Failed to save game state:', error);
      
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleStorageQuotaExceeded();
      }
      
      return false;
    }
  }

  /**
   * Load game state from local storage
   * @returns Loaded game state or null if not found/invalid
   */
  static loadGameState(): GameState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (!stored) {
        return null;
      }

      const parsed: SerializableGameState = JSON.parse(stored);
      
      // Validate version and migrate if necessary
      if (!this.isValidVersion(parsed.version)) {
        const migrated = this.migrateGameState(parsed);
        if (!migrated) {
          return null;
        }
        return this.deserializeGameState(migrated);
      }

      return this.deserializeGameState(parsed);
    } catch (error) {
      console.error('Failed to load game state:', error);
      
      // Clear corrupted data
      this.clearGameState();
      return null;
    }
  }

  /**
   * Clear saved game state
   */
  static clearGameState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    } catch (error) {
      console.error('Failed to clear game state:', error);
    }
  }

  /**
   * Check if a saved game state exists
   */
  static hasSavedGameState(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      return stored !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  static getStorageInfo(): {
    used: number;
    available: number;
    gameStateSize: number;
  } {
    try {
      const gameStateData = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      const gameStateSize = gameStateData ? gameStateData.length : 0;
      
      // Estimate total localStorage usage
      let totalUsed = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          totalUsed += key.length + (value ? value.length : 0);
        }
      }

      return {
        used: totalUsed,
        available: this.MAX_STORAGE_SIZE - totalUsed,
        gameStateSize
      };
    } catch (error) {
      return {
        used: 0,
        available: this.MAX_STORAGE_SIZE,
        gameStateSize: 0
      };
    }
  }

  /**
   * Convert GameState to serializable format
   */
  private static serializeGameState(gameState: GameState): SerializableGameState {
    return {
      board: gameState.board.map(row => 
        row.map(cell => ({
          hasMine: cell.hasMine,
          isRevealed: cell.isRevealed,
          isFlagged: cell.isFlagged,
          adjacentMines: cell.adjacentMines,
          coordinates: { x: cell.coordinates.x, y: cell.coordinates.y }
        }))
      ),
      gameStatus: gameState.gameStatus,
      startTime: gameState.startTime.toISOString(),
      flagCount: gameState.flagCount,
      revealedCount: gameState.revealedCount,
      difficulty: { ...gameState.difficulty },
      version: this.CURRENT_VERSION
    };
  }

  /**
   * Convert serializable format back to GameState
   */
  private static deserializeGameState(serializable: SerializableGameState): GameState {
    return {
      board: serializable.board.map(row => 
        row.map(cellData => ({
          hasMine: cellData.hasMine,
          isRevealed: cellData.isRevealed,
          isFlagged: cellData.isFlagged,
          adjacentMines: cellData.adjacentMines,
          coordinates: { x: cellData.coordinates.x, y: cellData.coordinates.y }
        }))
      ),
      gameStatus: serializable.gameStatus,
      startTime: new Date(serializable.startTime),
      flagCount: serializable.flagCount,
      revealedCount: serializable.revealedCount,
      difficulty: { ...serializable.difficulty }
    };
  }

  /**
   * Check if version is valid/supported
   */
  private static isValidVersion(version: string | undefined): boolean {
    if (!version) {
      return false;
    }
    
    // For now, only support current version
    // In future, add version compatibility logic here
    return version === this.CURRENT_VERSION;
  }

  /**
   * Migrate game state from older versions
   */
  private static migrateGameState(oldState: any): SerializableGameState | null {
    try {
      // Handle migration from versions without version field
      if (!oldState.version) {
        // Assume it's a very old format and try to migrate
        if (oldState.board && oldState.gameStatus && oldState.startTime) {
          return {
            ...oldState,
            version: this.CURRENT_VERSION,
            startTime: typeof oldState.startTime === 'string' 
              ? oldState.startTime 
              : new Date(oldState.startTime).toISOString()
          };
        }
      }

      // Add more migration logic here as versions evolve
      
      return null;
    } catch (error) {
      console.error('Failed to migrate game state:', error);
      return null;
    }
  }

  /**
   * Handle storage quota exceeded error
   */
  private static handleStorageQuotaExceeded(): void {
    try {
      // Try to free up space by removing old data
      const keysToCheck = [
        STORAGE_KEYS.STATISTICS,
        STORAGE_KEYS.PLAYER_PERFORMANCE
      ];

      for (const key of keysToCheck) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            
            // If it's an array (like game history), keep only recent entries
            if (Array.isArray(parsed)) {
              const trimmed = parsed.slice(-50); // Keep last 50 entries
              localStorage.setItem(key, JSON.stringify(trimmed));
            }
          } catch (parseError) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Failed to handle storage quota exceeded:', error);
    }
  }

  /**
   * Validate game state structure
   */
  static validateGameState(gameState: any): boolean {
    try {
      // Check required fields
      if (!gameState.board || !Array.isArray(gameState.board)) {
        return false;
      }

      if (!['playing', 'won', 'lost'].includes(gameState.gameStatus)) {
        return false;
      }

      if (!gameState.difficulty || 
          typeof gameState.difficulty.width !== 'number' ||
          typeof gameState.difficulty.height !== 'number' ||
          typeof gameState.difficulty.mineCount !== 'number') {
        return false;
      }

      // Validate board structure
      for (const row of gameState.board) {
        if (!Array.isArray(row)) {
          return false;
        }
        
        for (const cell of row) {
          if (typeof cell.hasMine !== 'boolean' ||
              typeof cell.isRevealed !== 'boolean' ||
              typeof cell.isFlagged !== 'boolean' ||
              typeof cell.adjacentMines !== 'number' ||
              !cell.coordinates ||
              typeof cell.coordinates.x !== 'number' ||
              typeof cell.coordinates.y !== 'number') {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create backup of current game state
   */
  static createBackup(): string | null {
    try {
      const gameState = this.loadGameState();
      if (!gameState) {
        return null;
      }

      const backup = {
        gameState: this.serializeGameState(gameState),
        timestamp: new Date().toISOString(),
        version: this.CURRENT_VERSION
      };

      return JSON.stringify(backup, null, 2);
    } catch (error) {
      console.error('Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore game state from backup
   */
  static restoreFromBackup(backupData: string): boolean {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.gameState || !this.isValidVersion(backup.version)) {
        return false;
      }

      const gameState = this.deserializeGameState(backup.gameState);
      
      if (!this.validateGameState(gameState)) {
        return false;
      }

      return this.saveGameState(gameState);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }
}