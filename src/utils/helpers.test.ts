import { describe, it, expect } from 'vitest'
import { 
  coordinatesEqual, 
  isValidCoordinate, 
  getAdjacentCoordinates,
  coordinateToIndex,
  indexToCoordinate,
  randomInt
} from './helpers'

describe('Helper Functions', () => {
  describe('coordinatesEqual', () => {
    it('should return true for equal coordinates', () => {
      expect(coordinatesEqual({ x: 5, y: 3 }, { x: 5, y: 3 })).toBe(true)
    })

    it('should return false for different coordinates', () => {
      expect(coordinatesEqual({ x: 5, y: 3 }, { x: 5, y: 4 })).toBe(false)
      expect(coordinatesEqual({ x: 5, y: 3 }, { x: 6, y: 3 })).toBe(false)
    })
  })

  describe('isValidCoordinate', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinate({ x: 0, y: 0 }, 10, 10)).toBe(true)
      expect(isValidCoordinate({ x: 9, y: 9 }, 10, 10)).toBe(true)
      expect(isValidCoordinate({ x: 5, y: 5 }, 10, 10)).toBe(true)
    })

    it('should return false for out-of-bounds coordinates', () => {
      expect(isValidCoordinate({ x: -1, y: 0 }, 10, 10)).toBe(false)
      expect(isValidCoordinate({ x: 0, y: -1 }, 10, 10)).toBe(false)
      expect(isValidCoordinate({ x: 10, y: 0 }, 10, 10)).toBe(false)
      expect(isValidCoordinate({ x: 0, y: 10 }, 10, 10)).toBe(false)
    })
  })

  describe('getAdjacentCoordinates', () => {
    it('should return 8 adjacent coordinates for center cell', () => {
      const adjacent = getAdjacentCoordinates({ x: 5, y: 5 }, 10, 10)
      expect(adjacent).toHaveLength(8)
    })

    it('should return 3 adjacent coordinates for corner cell', () => {
      const adjacent = getAdjacentCoordinates({ x: 0, y: 0 }, 10, 10)
      expect(adjacent).toHaveLength(3)
    })

    it('should return 5 adjacent coordinates for edge cell', () => {
      const adjacent = getAdjacentCoordinates({ x: 0, y: 5 }, 10, 10)
      expect(adjacent).toHaveLength(5)
    })
  })

  describe('coordinateToIndex and indexToCoordinate', () => {
    it('should convert coordinates to index correctly', () => {
      expect(coordinateToIndex({ x: 0, y: 0 }, 10)).toBe(0)
      expect(coordinateToIndex({ x: 5, y: 3 }, 10)).toBe(35)
      expect(coordinateToIndex({ x: 9, y: 9 }, 10)).toBe(99)
    })

    it('should convert index to coordinates correctly', () => {
      expect(indexToCoordinate(0, 10)).toEqual({ x: 0, y: 0 })
      expect(indexToCoordinate(35, 10)).toEqual({ x: 5, y: 3 })
      expect(indexToCoordinate(99, 10)).toEqual({ x: 9, y: 9 })
    })

    it('should be reversible', () => {
      const coord = { x: 7, y: 4 }
      const index = coordinateToIndex(coord, 10)
      const result = indexToCoordinate(index, 10)
      expect(result).toEqual(coord)
    })
  })

  describe('randomInt', () => {
    it('should generate numbers within range', () => {
      for (let i = 0; i < 100; i++) {
        const num = randomInt(1, 10)
        expect(num).toBeGreaterThanOrEqual(1)
        expect(num).toBeLessThanOrEqual(10)
      }
    })

    it('should return the same number when min equals max', () => {
      expect(randomInt(5, 5)).toBe(5)
    })
  })
})