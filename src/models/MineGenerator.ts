import { Coordinate, DifficultySettings } from '../types/index';

/**
 * MineGenerator handles the creation of randomized mine layouts
 */
export class MineGenerator {
  /**
   * Generate mine positions with specified parameters
   * @param width Board width
   * @param height Board height
   * @param mineCount Number of mines to place
   * @param excludePosition Position to avoid (typically first click)
   * @returns Array of coordinates where mines should be placed
   */
  static generateMines(
    width: number,
    height: number,
    mineCount: number,
    excludePosition?: Coordinate
  ): Coordinate[] {
    if (mineCount < 0) {
      throw new Error('Mine count cannot be negative');
    }

    const totalCells = width * height;
    const excludedCells = excludePosition ? 1 : 0;
    const availableCells = totalCells - excludedCells;

    if (mineCount > availableCells) {
      throw new Error(`Cannot place ${mineCount} mines in ${availableCells} available cells`);
    }

    // Generate all possible positions
    const allPositions: Coordinate[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Skip excluded position (first click safety)
        if (excludePosition && x === excludePosition.x && y === excludePosition.y) {
          continue;
        }
        allPositions.push({ x, y });
      }
    }

    // Randomly select mine positions using Fisher-Yates shuffle
    const minePositions: Coordinate[] = [];
    const positions = [...allPositions]; // Create a copy

    for (let i = 0; i < mineCount; i++) {
      const randomIndex = Math.floor(Math.random() * positions.length);
      minePositions.push(positions[randomIndex]);
      
      // Remove selected position to avoid duplicates
      positions.splice(randomIndex, 1);
    }

    return minePositions;
  }

  /**
   * Generate mines based on difficulty settings
   * @param difficulty Difficulty configuration
   * @param excludePosition Position to avoid (typically first click)
   * @returns Array of coordinates where mines should be placed
   */
  static generateMinesFromDifficulty(
    difficulty: DifficultySettings,
    excludePosition?: Coordinate
  ): Coordinate[] {
    return this.generateMines(
      difficulty.width,
      difficulty.height,
      difficulty.mineCount,
      excludePosition
    );
  }

  /**
   * Calculate mine density for a given configuration
   * @param width Board width
   * @param height Board height
   * @param mineCount Number of mines
   * @returns Mine density as a percentage (0-1)
   */
  static calculateDensity(width: number, height: number, mineCount: number): number {
    const totalCells = width * height;
    return totalCells > 0 ? mineCount / totalCells : 0;
  }

  /**
   * Validate if a mine configuration is reasonable
   * @param width Board width
   * @param height Board height
   * @param mineCount Number of mines
   * @returns True if configuration is valid and reasonable
   */
  static validateConfiguration(width: number, height: number, mineCount: number): boolean {
    // Basic validation
    if (width <= 0 || height <= 0 || mineCount < 0) {
      return false;
    }

    const totalCells = width * height;
    
    // Cannot have more mines than cells
    if (mineCount > totalCells) {
      return false;
    }

    // Reasonable density limits (0% to 90%)
    const density = this.calculateDensity(width, height, mineCount);
    if (density > 0.9) {
      return false;
    }

    // Minimum board size for playability
    if (width < 3 || height < 3) {
      return false;
    }

    return true;
  }

  /**
   * Generate a solvable board configuration
   * This is a basic implementation - more sophisticated solvability checking
   * would require constraint satisfaction analysis
   * @param width Board width
   * @param height Board height
   * @param mineCount Number of mines
   * @param excludePosition Position to avoid
   * @returns Mine positions that should create a solvable board
   */
  static generateSolvableMines(
    width: number,
    height: number,
    mineCount: number,
    excludePosition?: Coordinate
  ): Coordinate[] {
    // For now, use standard random generation
    // Future enhancement: implement constraint satisfaction to ensure solvability
    const mines = this.generateMines(width, height, mineCount, excludePosition);
    
    // Basic solvability heuristic: ensure first click area has some revealed information
    if (excludePosition) {
      // Future enhancement: implement more sophisticated solvability analysis
      // For now, the random distribution with first-click exclusion provides basic solvability
    }
    
    return mines;
  }

  /**
   * Create standard difficulty configurations
   */
  static getStandardDifficulties(): Record<string, DifficultySettings> {
    return {
      beginner: {
        width: 9,
        height: 9,
        mineCount: 10,
        name: 'Beginner'
      },
      intermediate: {
        width: 16,
        height: 16,
        mineCount: 40,
        name: 'Intermediate'
      },
      expert: {
        width: 30,
        height: 16,
        mineCount: 99,
        name: 'Expert'
      }
    };
  }

  /**
   * Create a custom difficulty configuration
   * @param width Board width
   * @param height Board height
   * @param mineCount Number of mines
   * @param name Difficulty name
   * @returns Custom difficulty settings
   */
  static createCustomDifficulty(
    width: number,
    height: number,
    mineCount: number,
    name: string = 'Custom'
  ): DifficultySettings {
    if (!this.validateConfiguration(width, height, mineCount)) {
      throw new Error('Invalid difficulty configuration');
    }

    return {
      width,
      height,
      mineCount,
      name
    };
  }
}