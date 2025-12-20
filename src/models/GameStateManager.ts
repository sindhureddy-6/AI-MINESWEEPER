import { GameState, Cell, DifficultySettings, Coordinate } from '../types/index';
import { GameBoard } from './GameBoard';
import { MineGenerator } from './MineGenerator';

/**
 * GameStateManager handles game state tracking and win/loss detection
 */
export class GameStateManager {
  private gameState: GameState;
  private gameBoard: GameBoard;
  private firstClickMade: boolean = false;

  constructor(difficulty: DifficultySettings) {
    this.gameBoard = new GameBoard(difficulty.width, difficulty.height, difficulty.mineCount);
    this.gameState = this.initializeGameState(difficulty);
  }

  /**
   * Initialize a new game state
   */
  private initializeGameState(difficulty: DifficultySettings): GameState {
    return {
      board: this.gameBoard.getBoard(),
      gameStatus: 'playing',
      startTime: new Date(),
      flagCount: 0,
      revealedCount: 0,
      difficulty
    };
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return {
      ...this.gameState,
      board: this.gameBoard.getBoard(),
      flagCount: this.gameBoard.getFlaggedCount(),
      revealedCount: this.gameBoard.getRevealedCount()
    };
  }

  /**
   * Get the game board
   */
  getGameBoard(): GameBoard {
    return this.gameBoard;
  }

  /**
   * Handle cell click - reveals cell and manages game state
   * @param x X coordinate
   * @param y Y coordinate
   * @returns True if action was successful
   */
  revealCell(x: number, y: number): boolean {
    if (this.gameState.gameStatus !== 'playing') {
      return false;
    }

    // Handle first click - generate mines avoiding this position
    if (!this.firstClickMade) {
      this.handleFirstClick({ x, y });
    }

    const cell = this.gameBoard.getCell(x, y);
    if (!cell || cell.isRevealed || cell.isFlagged) {
      return false;
    }

    // Reveal the cell
    const revealed = this.gameBoard.revealCell(x, y);
    if (!revealed) {
      return false;
    }

    // Check if mine was clicked
    if (cell.hasMine) {
      this.handleMineClick();
      return true;
    }

    // Handle cascade for zero-mine cells
    if (cell.adjacentMines === 0) {
      this.cascadeReveal(x, y);
    }

    // Update game state
    this.updateGameState();

    // Check for victory
    this.checkVictoryCondition();

    return true;
  }

  /**
   * Handle first click by generating mines
   */
  private handleFirstClick(firstClick: Coordinate): void {
    const minePositions = MineGenerator.generateMines(
      this.gameState.difficulty.width,
      this.gameState.difficulty.height,
      this.gameState.difficulty.mineCount,
      firstClick
    );

    this.gameBoard.placeMines(minePositions);
    this.firstClickMade = true;
  }

  /**
   * Handle mine click - end game with loss
   */
  private handleMineClick(): void {
    this.gameState.gameStatus = 'lost';
    
    // Reveal all mines
    const mineCells = this.gameBoard.getMineCells();
    mineCells.forEach(cell => {
      if (!cell.isRevealed) {
        this.gameBoard.revealCell(cell.coordinates.x, cell.coordinates.y);
      }
    });
  }

  /**
   * Cascade reveal for zero-mine cells
   */
  private cascadeReveal(x: number, y: number): void {
    const adjacentCoords = this.gameBoard.getAdjacentCoordinates(x, y);
    
    for (const coord of adjacentCoords) {
      const adjacentCell = this.gameBoard.getCell(coord.x, coord.y);
      
      if (adjacentCell && !adjacentCell.isRevealed && !adjacentCell.isFlagged && !adjacentCell.hasMine) {
        this.gameBoard.revealCell(coord.x, coord.y);
        
        // Recursively cascade if this cell also has zero adjacent mines
        if (adjacentCell.adjacentMines === 0) {
          this.cascadeReveal(coord.x, coord.y);
        }
      }
    }
  }

  /**
   * Toggle flag on a cell
   * @param x X coordinate
   * @param y Y coordinate
   * @returns True if action was successful
   */
  toggleFlag(x: number, y: number): boolean {
    if (this.gameState.gameStatus !== 'playing') {
      return false;
    }

    const success = this.gameBoard.toggleFlag(x, y);
    if (success) {
      this.updateGameState();
    }
    
    return success;
  }

  /**
   * Update game state counters
   */
  private updateGameState(): void {
    this.gameState.flagCount = this.gameBoard.getFlaggedCount();
    this.gameState.revealedCount = this.gameBoard.getRevealedCount();
  }

  /**
   * Check if victory condition is met
   */
  private checkVictoryCondition(): void {
    if (this.gameState.gameStatus === 'playing' && this.gameBoard.areAllSafeCellsRevealed()) {
      this.gameState.gameStatus = 'won';
    }
  }

  /**
   * Check if the game is over (won or lost)
   */
  isGameOver(): boolean {
    return this.gameState.gameStatus !== 'playing';
  }

  /**
   * Check if the game is won
   */
  isGameWon(): boolean {
    return this.gameState.gameStatus === 'won';
  }

  /**
   * Check if the game is lost
   */
  isGameLost(): boolean {
    return this.gameState.gameStatus === 'lost';
  }

  /**
   * Get game duration in milliseconds
   */
  getGameDuration(): number {
    return Date.now() - this.gameState.startTime.getTime();
  }

  /**
   * Get remaining mine count (total mines - flags placed)
   */
  getRemainingMineCount(): number {
    return this.gameState.difficulty.mineCount - this.gameState.flagCount;
  }

  /**
   * Reset the game to initial state
   */
  reset(): void {
    this.gameBoard = new GameBoard(
      this.gameState.difficulty.width,
      this.gameState.difficulty.height,
      this.gameState.difficulty.mineCount
    );
    this.gameState = this.initializeGameState(this.gameState.difficulty);
    this.firstClickMade = false;
  }

  /**
   * Start a new game with different difficulty
   */
  newGame(difficulty: DifficultySettings): void {
    this.gameBoard = new GameBoard(difficulty.width, difficulty.height, difficulty.mineCount);
    this.gameState = this.initializeGameState(difficulty);
    this.firstClickMade = false;
  }

  /**
   * Get all unrevealed safe cells (for victory condition checking)
   */
  getUnrevealedSafeCells(): Cell[] {
    return this.gameBoard.getSafeCells().filter(cell => !cell.isRevealed);
  }

  /**
   * Get all revealed mine cells (for loss condition checking)
   */
  getRevealedMineCells(): Cell[] {
    return this.gameBoard.getMineCells().filter(cell => cell.isRevealed);
  }

  /**
   * Validate game state consistency
   */
  validateGameState(): boolean {
    const board = this.gameBoard.getBoard();
    
    // Check that revealed count matches actual revealed cells
    const actualRevealedCount = board.flat().filter(cell => cell.isRevealed).length;
    if (actualRevealedCount !== this.gameState.revealedCount) {
      return false;
    }

    // Check that flag count matches actual flagged cells
    const actualFlagCount = board.flat().filter(cell => cell.isFlagged).length;
    if (actualFlagCount !== this.gameState.flagCount) {
      return false;
    }

    // Check victory condition consistency
    if (this.gameState.gameStatus === 'won') {
      if (!this.gameBoard.areAllSafeCellsRevealed()) {
        return false;
      }
    }

    // Check loss condition consistency
    if (this.gameState.gameStatus === 'lost') {
      const hasRevealedMine = this.gameBoard.getMineCells().some(cell => cell.isRevealed);
      if (!hasRevealedMine) {
        return false;
      }
    }

    return true;
  }
}