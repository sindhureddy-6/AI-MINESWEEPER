import { Coordinate, Constraint, Cell } from '../types/index.ts';
import { GameBoard } from '../models/GameBoard.ts';

/**
 * ConstraintSolver uses logical deduction to identify guaranteed safe cells and mines
 * based on revealed cell constraints
 */
export class ConstraintSolver {
  /**
   * Extract constraints from all revealed cells on the board
   * A constraint represents a revealed cell with its adjacent mine count
   * and the set of unrevealed adjacent cells
   */
  static extractConstraints(gameBoard: GameBoard): Constraint[] {
    const constraints: Constraint[] = [];
    const revealedCells = gameBoard.getRevealedCells();

    for (const cell of revealedCells) {
      const adjacentCells = gameBoard.getAdjacentCells(
        cell.coordinates.x,
        cell.coordinates.y
      );

      // Get unrevealed adjacent cells (excluding flagged cells)
      const unrevealedAdjacent = adjacentCells.filter(
        (c: Cell) => !c.isRevealed && !c.isFlagged
      );

      // Count already flagged adjacent cells
      const flaggedAdjacent = adjacentCells.filter((c: Cell) => c.isFlagged);

      // Calculate remaining mines needed in unrevealed cells
      const remainingMines = cell.adjacentMines - flaggedAdjacent.length;

      // Only create constraint if there are unrevealed cells and remaining mines to find
      if (unrevealedAdjacent.length > 0 && remainingMines >= 0) {
        constraints.push({
          centerCell: cell.coordinates,
          requiredMines: remainingMines,
          affectedCells: unrevealedAdjacent.map((c: Cell) => c.coordinates)
        });
      }
    }

    return constraints;
  }

  /**
   * Find cells that are guaranteed to be safe based on constraint analysis
   */
  static findGuaranteedSafe(gameBoard: GameBoard): Coordinate[] {
    const constraints = this.extractConstraints(gameBoard);
    const guaranteedSafe: Set<string> = new Set();

    for (const constraint of constraints) {
      // If required mines is 0, all affected cells are safe
      if (constraint.requiredMines === 0) {
        for (const coord of constraint.affectedCells) {
          guaranteedSafe.add(this.coordToString(coord));
        }
      }
    }

    // Convert back to coordinates
    return Array.from(guaranteedSafe).map(s => this.stringToCoord(s));
  }

  /**
   * Find cells that are guaranteed to contain mines based on constraint analysis
   */
  static findGuaranteedMines(gameBoard: GameBoard): Coordinate[] {
    const constraints = this.extractConstraints(gameBoard);
    const guaranteedMines: Set<string> = new Set();

    for (const constraint of constraints) {
      // If required mines equals number of affected cells, all are mines
      if (
        constraint.requiredMines === constraint.affectedCells.length &&
        constraint.requiredMines > 0
      ) {
        for (const coord of constraint.affectedCells) {
          guaranteedMines.add(this.coordToString(coord));
        }
      }
    }

    return Array.from(guaranteedMines).map(s => this.stringToCoord(s));
  }

  /**
   * Find all guaranteed moves using advanced constraint satisfaction
   * This method applies subset and superset deduction rules
   */
  static findGuaranteedMoves(gameBoard: GameBoard): {
    safe: Coordinate[];
    mines: Coordinate[];
  } {
    const constraints = this.extractConstraints(gameBoard);
    const guaranteedSafe: Set<string> = new Set();
    const guaranteedMines: Set<string> = new Set();

    // Apply simple rules first
    for (const constraint of constraints) {
      if (constraint.requiredMines === 0) {
        // All affected cells are safe
        for (const coord of constraint.affectedCells) {
          guaranteedSafe.add(this.coordToString(coord));
        }
      } else if (
        constraint.requiredMines === constraint.affectedCells.length &&
        constraint.requiredMines > 0
      ) {
        // All affected cells are mines
        for (const coord of constraint.affectedCells) {
          guaranteedMines.add(this.coordToString(coord));
        }
      }
    }

    // Apply subset/superset deduction
    for (let i = 0; i < constraints.length; i++) {
      for (let j = 0; j < constraints.length; j++) {
        if (i === j) continue;

        const c1 = constraints[i];
        const c2 = constraints[j];

        // Check if c1's affected cells are a subset of c2's
        const c1Set = new Set(c1.affectedCells.map(this.coordToString));
        const c2Set = new Set(c2.affectedCells.map(this.coordToString));

        if (this.isSubset(c1Set, c2Set)) {
          // c1 is subset of c2
          // Cells in c2 but not in c1
          const difference = Array.from(c2Set).filter(s => !c1Set.has(s));
          const mineDifference = c2.requiredMines - c1.requiredMines;

          if (mineDifference === 0) {
            // All cells in difference are safe
            difference.forEach(s => guaranteedSafe.add(s));
          } else if (mineDifference === difference.length && mineDifference > 0) {
            // All cells in difference are mines
            difference.forEach(s => guaranteedMines.add(s));
          }
        }
      }
    }

    return {
      safe: Array.from(guaranteedSafe).map(s => this.stringToCoord(s)),
      mines: Array.from(guaranteedMines).map(s => this.stringToCoord(s))
    };
  }

  /**
   * Validate that constraints are consistent (no contradictions)
   */
  static validateConstraints(constraints: Constraint[]): boolean {
    // Check for basic contradictions
    for (const constraint of constraints) {
      // Required mines cannot be negative
      if (constraint.requiredMines < 0) {
        return false;
      }

      // Required mines cannot exceed affected cells
      if (constraint.requiredMines > constraint.affectedCells.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: Convert coordinate to string for Set operations
   */
  private static coordToString(coord: Coordinate): string {
    return `${coord.x},${coord.y}`;
  }

  /**
   * Helper: Convert string back to coordinate
   */
  private static stringToCoord(str: string): Coordinate {
    const [x, y] = str.split(',').map(Number);
    return { x, y };
  }

  /**
   * Helper: Check if set1 is a subset of set2
   */
  private static isSubset<T>(set1: Set<T>, set2: Set<T>): boolean {
    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }
    return true;
  }
}
