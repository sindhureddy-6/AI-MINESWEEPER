import { Coordinate, Constraint, Cell } from '../types/index';
import { GameBoard } from '../models/GameBoard';
import { ConstraintSolver } from './ConstraintSolver';

/**
 * Configuration for mine assignment in constraint satisfaction
 */
interface MineAssignment {
  [cellKey: string]: boolean; // true = mine, false = safe
}

/**
 * ProbabilityCalculator computes mine probabilities for uncertain scenarios
 * using Bayesian inference and combinatorial analysis
 */
export class ProbabilityCalculator {
  /**
   * Calculate mine probabilities for all unrevealed cells
   */
  static calculateProbabilities(
    gameBoard: GameBoard
  ): Map<Coordinate, number> {
    const probabilities = new Map<Coordinate, number>();
    const constraints = ConstraintSolver.extractConstraints(gameBoard);
    const unrevealedCells = gameBoard.getUnrevealedCells()
      .filter((cell: Cell) => !cell.isFlagged)
      .map((cell: Cell) => cell.coordinates);

    if (unrevealedCells.length === 0) {
      return probabilities;
    }

    // Get cells that are part of constraints
    const constrainedCells = new Set<string>();
    constraints.forEach(constraint => {
      constraint.affectedCells.forEach(coord => {
        constrainedCells.add(this.coordToString(coord));
      });
    });

    // Separate constrained and unconstrained cells
    const constrainedCoords = unrevealedCells.filter((coord: Coordinate) =>
      constrainedCells.has(this.coordToString(coord))
    );
    const unconstrainedCoords = unrevealedCells.filter((coord: Coordinate) =>
      !constrainedCells.has(this.coordToString(coord))
    );

    // Calculate probabilities for constrained cells using CSP
    if (constrainedCoords.length > 0 && constraints.length > 0) {
      const constrainedProbs = this.calculateConstrainedProbabilities(
        constraints,
        constrainedCoords
      );
      constrainedProbs.forEach((prob, coord) => {
        probabilities.set(coord, prob);
      });
    }

    // Calculate probabilities for unconstrained cells
    if (unconstrainedCoords.length > 0) {
      const unconstrainedProb = this.calculateUnconstrainedProbability(
        gameBoard,
        constrainedCoords.length,
        unconstrainedCoords.length
      );
      
      unconstrainedCoords.forEach((coord: Coordinate) => {
        probabilities.set(coord, unconstrainedProb);
      });
    }

    return probabilities;
  }

  /**
   * Calculate probabilities for cells involved in constraints using CSP solving
   */
  private static calculateConstrainedProbabilities(
    constraints: Constraint[],
    constrainedCells: Coordinate[]
  ): Map<Coordinate, number> {
    const probabilities = new Map<Coordinate, number>();
    
    // Initialize all probabilities to 0
    constrainedCells.forEach(coord => {
      probabilities.set(coord, 0);
    });

    // Generate all valid mine assignments
    const validAssignments = this.generateValidAssignments(
      constraints,
      constrainedCells
    );

    if (validAssignments.length === 0) {
      // No valid assignments - return uniform probability
      const uniformProb = 0.5;
      constrainedCells.forEach(coord => {
        probabilities.set(coord, uniformProb);
      });
      return probabilities;
    }

    // Count how many times each cell is a mine across all valid assignments
    const mineCounts = new Map<string, number>();
    constrainedCells.forEach(coord => {
      mineCounts.set(this.coordToString(coord), 0);
    });

    validAssignments.forEach(assignment => {
      Object.entries(assignment).forEach(([cellKey, isMine]) => {
        if (isMine && mineCounts.has(cellKey)) {
          mineCounts.set(cellKey, mineCounts.get(cellKey)! + 1);
        }
      });
    });

    // Calculate probabilities as frequency of being a mine
    constrainedCells.forEach(coord => {
      const cellKey = this.coordToString(coord);
      const mineCount = mineCounts.get(cellKey) || 0;
      const probability = mineCount / validAssignments.length;
      probabilities.set(coord, probability);
    });

    return probabilities;
  }

  /**
   * Generate all valid mine assignments that satisfy the constraints
   */
  private static generateValidAssignments(
    constraints: Constraint[],
    cells: Coordinate[]
  ): MineAssignment[] {
    const validAssignments: MineAssignment[] = [];
    const cellKeys = cells.map(this.coordToString);
    
    // Generate all possible assignments (2^n combinations)
    const totalCombinations = Math.pow(2, cells.length);
    
    // Limit combinations for performance (max 20 cells = 1M combinations)
    const maxCombinations = Math.min(totalCombinations, 1000000);
    
    for (let i = 0; i < maxCombinations; i++) {
      const assignment: MineAssignment = {};
      
      // Convert binary representation to mine assignment
      for (let j = 0; j < cells.length; j++) {
        const isMine = (i & (1 << j)) !== 0;
        assignment[cellKeys[j]] = isMine;
      }
      
      // Check if this assignment satisfies all constraints
      if (this.isValidAssignment(assignment, constraints)) {
        validAssignments.push(assignment);
      }
    }
    
    return validAssignments;
  }

  /**
   * Check if a mine assignment satisfies all constraints
   */
  private static isValidAssignment(
    assignment: MineAssignment,
    constraints: Constraint[]
  ): boolean {
    for (const constraint of constraints) {
      let mineCount = 0;
      
      for (const coord of constraint.affectedCells) {
        const cellKey = this.coordToString(coord);
        if (assignment[cellKey] === true) {
          mineCount++;
        }
      }
      
      if (mineCount !== constraint.requiredMines) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate probability for unconstrained cells based on remaining mines
   */
  private static calculateUnconstrainedProbability(
    gameBoard: GameBoard,
    constrainedCellCount: number,
    unconstrainedCellCount: number
  ): number {
    if (unconstrainedCellCount === 0) {
      return 0;
    }

    // Calculate remaining mines
    const totalMines = gameBoard.getMineCount();
    const flaggedCount = gameBoard.getFlaggedCount();
    const revealedMines = gameBoard.getRevealedCells()
      .filter((cell: Cell) => cell.hasMine).length;
    
    const remainingMines = totalMines - flaggedCount - revealedMines;
    
    // Estimate mines in constrained area (rough approximation)
    const estimatedConstrainedMines = Math.min(
      remainingMines,
      Math.round(constrainedCellCount * 0.2) // Assume ~20% mine density
    );
    
    const remainingUnconstrainedMines = Math.max(
      0,
      remainingMines - estimatedConstrainedMines
    );
    
    return Math.min(1, remainingUnconstrainedMines / unconstrainedCellCount);
  }

  /**
   * Calculate information gain for revealing a specific cell
   * Higher values indicate moves that provide more information
   */
  static calculateInformationGain(
    coord: Coordinate,
    gameBoard: GameBoard
  ): number {
    const adjacentCells = gameBoard.getAdjacentCells(coord.x, coord.y);
    const unrevealedAdjacent = adjacentCells.filter(
      cell => !cell.isRevealed && !cell.isFlagged
    );
    
    // Information gain is roughly proportional to:
    // 1. Number of unrevealed adjacent cells (more constraints created)
    // 2. Number of existing adjacent constraints (more deductions possible)
    const revealedAdjacent = adjacentCells.filter((cell: Cell) => cell.isRevealed);
    
    const baseGain = unrevealedAdjacent.length;
    const constraintBonus = revealedAdjacent.length * 0.5;
    
    return baseGain + constraintBonus;
  }

  /**
   * Find the cell with lowest mine probability
   */
  static findLowestRiskCell(
    probabilities: Map<Coordinate, number>
  ): Coordinate | null {
    if (probabilities.size === 0) {
      return null;
    }

    let lowestRisk: Coordinate | null = null;
    let lowestProbability = 1;

    probabilities.forEach((probability, coord) => {
      if (probability < lowestProbability) {
        lowestProbability = probability;
        lowestRisk = coord;
      }
    });

    return lowestRisk;
  }

  /**
   * Handle edge cases in probability calculation
   */
  static handleEdgeCases(
    gameBoard: GameBoard,
    probabilities: Map<Coordinate, number>
  ): Map<Coordinate, number> {
    const adjustedProbabilities = new Map(probabilities);
    
    // Handle corner and edge cells (typically lower risk in early game)
    const { width, height } = gameBoard.getDimensions();
    const revealedCount = gameBoard.getRevealedCount();
    
    // Early game bonus for corners and edges
    if (revealedCount < (width * height) * 0.1) {
      adjustedProbabilities.forEach((prob, coord) => {
        const isCorner = (coord.x === 0 || coord.x === width - 1) &&
                        (coord.y === 0 || coord.y === height - 1);
        const isEdge = coord.x === 0 || coord.x === width - 1 ||
                      coord.y === 0 || coord.y === height - 1;
        
        if (isCorner) {
          adjustedProbabilities.set(coord, prob * 0.8); // 20% bonus
        } else if (isEdge) {
          adjustedProbabilities.set(coord, prob * 0.9); // 10% bonus
        }
      });
    }
    
    return adjustedProbabilities;
  }

  /**
   * Helper: Convert coordinate to string for map operations
   */
  private static coordToString(coord: Coordinate): string {
    return `${coord.x},${coord.y}`;
  }


}