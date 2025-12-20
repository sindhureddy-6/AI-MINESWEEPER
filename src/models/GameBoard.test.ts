import { describe, it, expect, beforeEach } from 'vitest'
import { GameBoard } from './GameBoard'
import { GameStateManager } from './GameStateManager'
import { DifficultySettings } from '../types/index'

describe('GameBoard - Cell Revelation System', () => {
  let gameBoard: GameBoard

  beforeEach(() => {
    gameBoard = new GameBoard(5, 5, 3)
  })

  describe('Single cell reveal', () => {
    it('should reveal a cell and show correct adjacent mine count', () => {
      // Place mines manually for predictable testing
      const minePositions = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
      gameBoard.placeMines(minePositions)

      // Reveal cell at (1, 1) which should have 3 adjacent mines (all three mines touch it)
      const success = gameBoard.revealCell(1, 1)
      const cell = gameBoard.getCell(1, 1)

      expect(success).toBe(true)
      expect(cell?.isRevealed).toBe(true)
      expect(cell?.adjacentMines).toBe(3)
    })

    it('should not reveal already revealed cells', () => {
      gameBoard.revealCell(2, 2)
      const firstReveal = gameBoard.getCell(2, 2)?.isRevealed

      const secondReveal = gameBoard.revealCell(2, 2)
      
      expect(firstReveal).toBe(true)
      expect(secondReveal).toBe(false) // Should return false for already revealed
    })

    it('should not reveal flagged cells', () => {
      gameBoard.toggleFlag(2, 2)
      const success = gameBoard.revealCell(2, 2)
      const cell = gameBoard.getCell(2, 2)

      expect(success).toBe(false)
      expect(cell?.isRevealed).toBe(false)
      expect(cell?.isFlagged).toBe(true)
    })
  })

  describe('Cascade logic for zero-mine cells', () => {
    it('should cascade reveal adjacent safe cells when revealing zero-mine cell', () => {
      // Create a deterministic test by manually placing mines
      const gameBoard = new GameBoard(5, 5, 1)
      
      // Place mine far from corner to ensure cascade at (0,0)
      gameBoard.placeMines([{ x: 4, y: 4 }])
      
      // Create GameStateManager with pre-configured board
      const testDifficulty: DifficultySettings = {
        width: 5,
        height: 5,
        mineCount: 1,
        name: 'test'
      }
      const testGameManager = new GameStateManager(testDifficulty)
      
      // Replace the game board with our pre-configured one
      testGameManager['gameBoard'] = gameBoard
      testGameManager['firstClickMade'] = true
      
      // Reveal corner cell (0, 0) - should have 0 adjacent mines and cascade
      testGameManager.revealCell(0, 0)
      
      const cornerCell = gameBoard.getCell(0, 0)
      expect(cornerCell?.isRevealed).toBe(true)
      
      // Should have revealed more than just the initial cell due to cascade
      const totalRevealed = gameBoard.getRevealedCount()
      expect(totalRevealed).toBeGreaterThan(1)
    })

    it('should handle boundary conditions during cascade', () => {
      // Create a deterministic test by manually placing mines
      const gameBoard = new GameBoard(5, 5, 1)
      
      // Place mine far from corner to ensure cascade at (0,0)
      gameBoard.placeMines([{ x: 4, y: 4 }])
      
      // Reveal corner cell (0, 0) - should have 0 adjacent mines and cascade
      const revealed = gameBoard.revealCell(0, 0)
      expect(revealed).toBe(true)
      
      const cornerCell = gameBoard.getCell(0, 0)
      expect(cornerCell?.isRevealed).toBe(true)
      expect(cornerCell?.adjacentMines).toBe(0)
      
      // Now test cascade manually by creating a GameStateManager with this board
      // Since we can't easily inject the board, let's just test that boundary
      // conditions don't crash the cascade logic
      const testDifficulty: DifficultySettings = {
        width: 3,
        height: 3,
        mineCount: 1,
        name: 'test'
      }
      const testGameManager = new GameStateManager(testDifficulty)
      
      // Reveal corner - should not crash
      testGameManager.revealCell(0, 0)
      const revealedCount = testGameManager.getGameBoard().getRevealedCount()
      expect(revealedCount).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Flag Toggle System', () => {
  let gameBoard: GameBoard
  let gameManager: GameStateManager
  let difficulty: DifficultySettings

  beforeEach(() => {
    difficulty = {
      width: 5,
      height: 5,
      mineCount: 3,
      name: 'test'
    }
    gameBoard = new GameBoard(5, 5, 3)
    gameManager = new GameStateManager(difficulty)
  })

  it('should toggle flag on unrevealed cell', () => {
    const cell = gameBoard.getCell(2, 2)
    expect(cell?.isFlagged).toBe(false)

    // First toggle - should add flag
    const success1 = gameBoard.toggleFlag(2, 2)
    expect(success1).toBe(true)
    expect(cell?.isFlagged).toBe(true)

    // Second toggle - should remove flag
    const success2 = gameBoard.toggleFlag(2, 2)
    expect(success2).toBe(true)
    expect(cell?.isFlagged).toBe(false)
  })

  it('should not allow flagging revealed cells', () => {
    // Reveal the cell first
    gameBoard.revealCell(2, 2)
    const cell = gameBoard.getCell(2, 2)
    expect(cell?.isRevealed).toBe(true)

    // Try to flag - should fail
    const success = gameBoard.toggleFlag(2, 2)
    expect(success).toBe(false)
    expect(cell?.isFlagged).toBe(false)
  })

  it('should track flag count correctly', () => {
    expect(gameBoard.getFlaggedCount()).toBe(0)

    // Add some flags
    gameBoard.toggleFlag(0, 0)
    gameBoard.toggleFlag(1, 1)
    gameBoard.toggleFlag(2, 2)
    expect(gameBoard.getFlaggedCount()).toBe(3)

    // Remove one flag
    gameBoard.toggleFlag(1, 1)
    expect(gameBoard.getFlaggedCount()).toBe(2)

    // Remove all flags
    gameBoard.toggleFlag(0, 0)
    gameBoard.toggleFlag(2, 2)
    expect(gameBoard.getFlaggedCount()).toBe(0)
  })

  it('should prevent revealing flagged cells', () => {
    // Flag a cell
    gameBoard.toggleFlag(2, 2)
    const cell = gameBoard.getCell(2, 2)
    expect(cell?.isFlagged).toBe(true)

    // Try to reveal - should fail
    const success = gameBoard.revealCell(2, 2)
    expect(success).toBe(false)
    expect(cell?.isRevealed).toBe(false)
  })

  it('should handle flag state validation', () => {
    // Test invalid coordinates
    const invalidFlag = gameBoard.toggleFlag(-1, -1)
    expect(invalidFlag).toBe(false)

    const outOfBounds = gameBoard.toggleFlag(10, 10)
    expect(outOfBounds).toBe(false)
  })

  it('should persist flag state through game state manager', () => {
    // Use GameStateManager to test flag persistence
    const initialFlagCount = gameManager.getGameState().flagCount
    expect(initialFlagCount).toBe(0)

    // Toggle flag through game manager
    const success = gameManager.toggleFlag(1, 1)
    expect(success).toBe(true)

    // Check that game state is updated
    const updatedState = gameManager.getGameState()
    expect(updatedState.flagCount).toBe(1)

    // Check that the cell is actually flagged
    const cell = gameManager.getGameBoard().getCell(1, 1)
    expect(cell?.isFlagged).toBe(true)
  })
})