import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { 
  coordinateToIndex, 
  indexToCoordinate, 
  isValidCoordinate,
  getAdjacentCoordinates 
} from './helpers'

describe('Helper Functions - Property Tests', () => {
  it('coordinate conversion should be reversible', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 50 }), // width
      fc.integer({ min: 0, max: 49 }), // x coordinate
      fc.integer({ min: 0, max: 49 }), // y coordinate
      (width, x, y) => {
        // Ensure coordinates are within bounds
        if (x >= width) return true // Skip invalid cases
        
        const coord = { x, y }
        const index = coordinateToIndex(coord, width)
        const result = indexToCoordinate(index, width)
        
        return coord.x === result.x && coord.y === result.y
      }
    ), { numRuns: 100 })
  })

  it('adjacent coordinates should always be valid when within bounds', () => {
    fc.assert(fc.property(
      fc.integer({ min: 3, max: 20 }), // width
      fc.integer({ min: 3, max: 20 }), // height
      fc.integer({ min: 0, max: 19 }), // x coordinate
      fc.integer({ min: 0, max: 19 }), // y coordinate
      (width, height, x, y) => {
        // Ensure coordinates are within bounds
        if (x >= width || y >= height) return true // Skip invalid cases
        
        const coord = { x, y }
        const adjacent = getAdjacentCoordinates(coord, width, height)
        
        // All adjacent coordinates should be valid
        return adjacent.every(adj => isValidCoordinate(adj, width, height))
      }
    ), { numRuns: 100 })
  })

  it('adjacent coordinates should never include the center cell', () => {
    fc.assert(fc.property(
      fc.integer({ min: 3, max: 20 }), // width
      fc.integer({ min: 3, max: 20 }), // height
      fc.integer({ min: 1, max: 18 }), // x coordinate (avoid edges for simplicity)
      fc.integer({ min: 1, max: 18 }), // y coordinate (avoid edges for simplicity)
      (width, height, x, y) => {
        // Ensure coordinates are within bounds
        if (x >= width || y >= height) return true // Skip invalid cases
        
        const coord = { x, y }
        const adjacent = getAdjacentCoordinates(coord, width, height)
        
        // Adjacent coordinates should not include the center cell
        return !adjacent.some(adj => adj.x === coord.x && adj.y === coord.y)
      }
    ), { numRuns: 100 })
  })
})