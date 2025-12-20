import { Cell, Coordinate } from '../types/index';

/**
 * GameBoard class manages the minesweeper grid state and operations
 */
export class GameBoard {
  private board: Cell[][];
  private width: number;
  private height: number;
  private mineCount: number;

  constructor(width: number, height: number, mineCount: number) {
    this.width = width;
    this.height = height;
    this.mineCount = mineCount;
    this.board = this.initializeBoard();
  }

  /**
   * Initialize empty board with all cells unrevealed and unflagged
   */
  private initializeBoard(): Cell[][] {
    const board: Cell[][] = [];
    
    for (let y = 0; y < this.height; y++) {
      board[y] = [];
      for (let x = 0; x < this.width; x++) {
        board[y][x] = {
          hasMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0,
          coordinates: { x, y }
        };
      }
    }
    
    return board;
  }

  /**
   * Get cell at specified coordinates
   */
  getCell(x: number, y: number): Cell | null {
    if (!this.isValidCoordinate(x, y)) {
      return null;
    }
    return this.board[y][x];
  }

  /**
   * Get the entire board as a 2D array
   */
  getBoard(): Cell[][] {
    return this.board;
  }

  /**
   * Check if coordinates are within board boundaries
   */
  isValidCoordinate(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Get all adjacent cells to a given coordinate
   */
  getAdjacentCells(x: number, y: number): Cell[] {
    const adjacent: Cell[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip center cell
        
        const adjX = x + dx;
        const adjY = y + dy;
        
        if (this.isValidCoordinate(adjX, adjY)) {
          adjacent.push(this.board[adjY][adjX]);
        }
      }
    }
    
    return adjacent;
  }

  /**
   * Get coordinates of all adjacent cells
   */
  getAdjacentCoordinates(x: number, y: number): Coordinate[] {
    const adjacent: Coordinate[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip center cell
        
        const adjX = x + dx;
        const adjY = y + dy;
        
        if (this.isValidCoordinate(adjX, adjY)) {
          adjacent.push({ x: adjX, y: adjY });
        }
      }
    }
    
    return adjacent;
  }

  /**
   * Place mines on the board, avoiding the first click position
   */
  placeMines(minePositions: Coordinate[]): void {
    // Clear any existing mines
    this.clearMines();
    
    // Place mines at specified positions
    for (const pos of minePositions) {
      if (this.isValidCoordinate(pos.x, pos.y)) {
        this.board[pos.y][pos.x].hasMine = true;
      }
    }
    
    // Calculate adjacent mine counts for all cells
    this.calculateAdjacentMines();
  }

  /**
   * Clear all mines from the board
   */
  private clearMines(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.board[y][x].hasMine = false;
        this.board[y][x].adjacentMines = 0;
      }
    }
  }

  /**
   * Calculate adjacent mine counts for all cells
   */
  private calculateAdjacentMines(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.board[y][x].hasMine) {
          const adjacentCells = this.getAdjacentCells(x, y);
          this.board[y][x].adjacentMines = adjacentCells.filter(cell => cell.hasMine).length;
        }
      }
    }
  }

  /**
   * Reveal a cell at the specified coordinates
   */
  revealCell(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || cell.isRevealed || cell.isFlagged) {
      return false;
    }
    
    cell.isRevealed = true;
    return true;
  }

  /**
   * Toggle flag on a cell
   */
  toggleFlag(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || cell.isRevealed) {
      return false;
    }
    
    cell.isFlagged = !cell.isFlagged;
    return true;
  }

  /**
   * Get all unrevealed cells
   */
  getUnrevealedCells(): Cell[] {
    const unrevealed: Cell[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.board[y][x].isRevealed) {
          unrevealed.push(this.board[y][x]);
        }
      }
    }
    
    return unrevealed;
  }

  /**
   * Get all revealed cells
   */
  getRevealedCells(): Cell[] {
    const revealed: Cell[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].isRevealed) {
          revealed.push(this.board[y][x]);
        }
      }
    }
    
    return revealed;
  }

  /**
   * Get all flagged cells
   */
  getFlaggedCells(): Cell[] {
    const flagged: Cell[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].isFlagged) {
          flagged.push(this.board[y][x]);
        }
      }
    }
    
    return flagged;
  }

  /**
   * Get all cells containing mines
   */
  getMineCells(): Cell[] {
    const mines: Cell[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].hasMine) {
          mines.push(this.board[y][x]);
        }
      }
    }
    
    return mines;
  }

  /**
   * Get all safe (non-mine) cells
   */
  getSafeCells(): Cell[] {
    const safe: Cell[] = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.board[y][x].hasMine) {
          safe.push(this.board[y][x]);
        }
      }
    }
    
    return safe;
  }

  /**
   * Check if all safe cells are revealed (victory condition)
   */
  areAllSafeCellsRevealed(): boolean {
    const safeCells = this.getSafeCells();
    return safeCells.every(cell => cell.isRevealed);
  }

  /**
   * Get board dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get total mine count
   */
  getMineCount(): number {
    return this.mineCount;
  }

  /**
   * Get count of revealed cells
   */
  getRevealedCount(): number {
    return this.getRevealedCells().length;
  }

  /**
   * Get count of flagged cells
   */
  getFlaggedCount(): number {
    return this.getFlaggedCells().length;
  }

  /**
   * Reset board to initial state (keep dimensions and mine positions)
   */
  reset(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.board[y][x].isRevealed = false;
        this.board[y][x].isFlagged = false;
      }
    }
  }
}