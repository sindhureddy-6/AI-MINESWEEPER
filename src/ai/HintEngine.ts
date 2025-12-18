import { Coordinate, HintAnalysis } from '../types/index.js';
import { GameBoard } from '../models/GameBoard.js';
import { ConstraintSolver } from './ConstraintSolver.js';
import { ProbabilityCalculator } from './ProbabilityCalculator.js';

/**
 * Move recommendation with priority scoring
 */
interface MoveRecommendation {
  coordinate: Coordinate;
  probability: number;
  priority: number;
  reasoning: string;
}

/**
 * HintEngine provides intelligent move suggestions by integrating
 * constraint solving and probability analysis
 */
export class HintEngine {
  /**
   * Analyze the current board state and provide comprehensive hint analysis
   */
  static analyzeBoard(gameBoard: GameBoard): HintAnalysis {
    // Find guaranteed moves using constraint solving
    const guaranteedMoves = ConstraintSolver.findGuaranteedMoves(gameBoard);
    
    // Calculate probabilities for all unrevealed cells
    const probabilities = ProbabilityCalculator.calculateProbabilities(gameBoard);
    
    // Apply edge case handling to probabilities
    const adjustedProbabilities = ProbabilityCalculator.handleEdgeCases(
      gameBoard,
      probabilities
    );
    
    // Find the best move recommendation
    const recommendedMove = this.getBestMove(gameBoard, guaranteedMoves, adjustedProbabilities);
    
    // Calculate confidence based on available information
    const confidence = this.calculateConfidence(guaranteedMoves, adjustedProbabilities);
    
    return {
      guaranteedSafe: guaranteedMoves.safe,
      guaranteedMines: guaranteedMoves.mines,
      probabilities: adjustedProbabilities,
      recommendedMove: recommendedMove?.coordinate || null,
      confidence
    };
  }

  /**
   * Get the best move recommendation based on priority scoring
   */
  static getBestMove(
    gameBoard: GameBoard,
    guaranteedMoves: { safe: Coordinate[]; mines: Coordinate[] },
    probabilities: Map<Coordinate, number>
  ): MoveRecommendation | null {
    // Priority 1: Guaranteed safe moves
    if (guaranteedMoves.safe.length > 0) {
      const bestSafe = this.selectBestGuaranteedSafe(gameBoard, guaranteedMoves.safe);
      return {
        coordinate: bestSafe,
        probability: 0,
        priority: 1000, // Highest priority
        reasoning: 'Guaranteed safe move'
      };
    }

    // Priority 2: Probabilistic moves
    if (probabilities.size > 0) {
      return this.selectBestProbabilisticMove(gameBoard, probabilities);
    }

    // No moves available
    return null;
  }

  /**
   * Select the best guaranteed safe move based on information gain
   */
  private static selectBestGuaranteedSafe(
    gameBoard: GameBoard,
    safeMoves: Coordinate[]
  ): Coordinate {
    if (safeMoves.length === 1) {
      return safeMoves[0];
    }

    // Choose safe move with highest information gain
    let bestMove = safeMoves[0];
    let bestGain = ProbabilityCalculator.calculateInformationGain(bestMove, gameBoard);

    for (let i = 1; i < safeMoves.length; i++) {
      const gain = ProbabilityCalculator.calculateInformationGain(safeMoves[i], gameBoard);
      if (gain > bestGain) {
        bestGain = gain;
        bestMove = safeMoves[i];
      }
    }

    return bestMove;
  }

  /**
   * Select the best probabilistic move using priority scoring
   */
  private static selectBestProbabilisticMove(
    gameBoard: GameBoard,
    probabilities: Map<Coordinate, number>
  ): MoveRecommendation | null {
    const recommendations: MoveRecommendation[] = [];

    // Generate recommendations for all cells
    probabilities.forEach((probability, coord) => {
      const informationGain = ProbabilityCalculator.calculateInformationGain(coord, gameBoard);
      const priority = this.calculateMovePriority(probability, informationGain);
      
      recommendations.push({
        coordinate: coord,
        probability,
        priority,
        reasoning: this.generateMoveReasoning(probability)
      });
    });

    if (recommendations.length === 0) {
      return null;
    }

    // Sort by priority (higher is better)
    recommendations.sort((a, b) => b.priority - a.priority);
    
    return recommendations[0];
  }

  /**
   * Calculate move priority based on probability and information gain
   */
  private static calculateMovePriority(
    probability: number,
    informationGain: number
  ): number {
    // Lower probability is better (safer move)
    const safetyScore = (1 - probability) * 100;
    
    // Higher information gain is better
    const informationScore = informationGain * 10;
    
    // Combine scores with safety being more important
    return safetyScore * 0.7 + informationScore * 0.3;
  }

  /**
   * Generate human-readable reasoning for move recommendation
   */
  private static generateMoveReasoning(
    probability: number
  ): string {
    if (probability === 0) {
      return 'Guaranteed safe move';
    } else if (probability < 0.1) {
      return `Very low risk (${Math.round(probability * 100)}% mine probability)`;
    } else if (probability < 0.3) {
      return `Low risk (${Math.round(probability * 100)}% mine probability)`;
    } else if (probability < 0.5) {
      return `Moderate risk (${Math.round(probability * 100)}% mine probability)`;
    } else if (probability < 0.7) {
      return `High risk (${Math.round(probability * 100)}% mine probability)`;
    } else {
      return `Very high risk (${Math.round(probability * 100)}% mine probability)`;
    }
  }

  /**
   * Calculate confidence level of the analysis
   */
  private static calculateConfidence(
    guaranteedMoves: { safe: Coordinate[]; mines: Coordinate[] },
    probabilities: Map<Coordinate, number>
  ): number {
    // High confidence if we have guaranteed moves
    if (guaranteedMoves.safe.length > 0 || guaranteedMoves.mines.length > 0) {
      return 0.9;
    }

    // Medium confidence if we have clear probability differences
    if (probabilities.size > 0) {
      const probs = Array.from(probabilities.values());
      const minProb = Math.min(...probs);
      const maxProb = Math.max(...probs);
      
      // Higher confidence when there's a clear best choice
      const spread = maxProb - minProb;
      if (spread > 0.3) {
        return 0.7;
      } else if (spread > 0.1) {
        return 0.5;
      } else {
        return 0.3;
      }
    }

    // Low confidence when no information available
    return 0.1;
  }

  /**
   * Get multiple move suggestions ranked by priority
   */
  static getTopMoves(
    gameBoard: GameBoard,
    count: number = 3
  ): MoveRecommendation[] {
    const guaranteedMoves = ConstraintSolver.findGuaranteedMoves(gameBoard);
    const probabilities = ProbabilityCalculator.calculateProbabilities(gameBoard);
    const adjustedProbabilities = ProbabilityCalculator.handleEdgeCases(
      gameBoard,
      probabilities
    );

    const recommendations: MoveRecommendation[] = [];

    // Add guaranteed safe moves first
    guaranteedMoves.safe.forEach(coord => {
      recommendations.push({
        coordinate: coord,
        probability: 0,
        priority: 1000,
        reasoning: 'Guaranteed safe move'
      });
    });

    // Add probabilistic moves
    adjustedProbabilities.forEach((probability, coord) => {
      const informationGain = ProbabilityCalculator.calculateInformationGain(coord, gameBoard);
      const priority = this.calculateMovePriority(probability, informationGain);
      
      recommendations.push({
        coordinate: coord,
        probability,
        priority,
        reasoning: this.generateMoveReasoning(probability)
      });
    });

    // Sort by priority and return top moves
    recommendations.sort((a, b) => b.priority - a.priority);
    return recommendations.slice(0, count);
  }

  /**
   * Check if the current board state has any solvable moves
   */
  static hasSolvableMoves(gameBoard: GameBoard): boolean {
    const guaranteedMoves = ConstraintSolver.findGuaranteedMoves(gameBoard);
    return guaranteedMoves.safe.length > 0;
  }

  /**
   * Get fallback move when no good options exist (lowest risk)
   */
  static getFallbackMove(gameBoard: GameBoard): Coordinate | null {
    const probabilities = ProbabilityCalculator.calculateProbabilities(gameBoard);
    
    if (probabilities.size === 0) {
      // No unrevealed cells
      return null;
    }

    return ProbabilityCalculator.findLowestRiskCell(probabilities);
  }

  /**
   * Validate that a suggested move is legal
   */
  static isValidMove(coord: Coordinate, gameBoard: GameBoard): boolean {
    const cell = gameBoard.getCell(coord.x, coord.y);
    return cell !== null && !cell.isRevealed && !cell.isFlagged;
  }

  /**
   * Get detailed analysis for a specific cell
   */
  static analyzeCellRisk(
    coord: Coordinate,
    gameBoard: GameBoard
  ): {
    probability: number;
    reasoning: string;
    isGuaranteedSafe: boolean;
    isGuaranteedMine: boolean;
  } {
    const guaranteedMoves = ConstraintSolver.findGuaranteedMoves(gameBoard);
    const probabilities = ProbabilityCalculator.calculateProbabilities(gameBoard);
    
    const isGuaranteedSafe = guaranteedMoves.safe.some(
      safe => safe.x === coord.x && safe.y === coord.y
    );
    const isGuaranteedMine = guaranteedMoves.mines.some(
      mine => mine.x === coord.x && mine.y === coord.y
    );
    
    const probability = probabilities.get(coord) || 0.5;
    
    let reasoning: string;
    if (isGuaranteedSafe) {
      reasoning = 'Guaranteed safe by constraint analysis';
    } else if (isGuaranteedMine) {
      reasoning = 'Guaranteed mine by constraint analysis';
    } else {
      reasoning = this.generateMoveReasoning(probability);
    }
    
    return {
      probability,
      reasoning,
      isGuaranteedSafe,
      isGuaranteedMine
    };
  }
}