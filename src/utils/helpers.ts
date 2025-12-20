import { Coordinate, Cell } from '../types/index'

/**
 * Utility functions for coordinate and board operations
 */

// Check if coordinates are equal
export const coordinatesEqual = (a: Coordinate, b: Coordinate): boolean => {
  return a.x === b.x && a.y === b.y
}

// Check if coordinates are within board bounds
export const isValidCoordinate = (coord: Coordinate, width: number, height: number): boolean => {
  return coord.x >= 0 && coord.x < width && coord.y >= 0 && coord.y < height
}

// Get all adjacent coordinates (8-directional)
export const getAdjacentCoordinates = (coord: Coordinate, width: number, height: number): Coordinate[] => {
  const adjacent: Coordinate[] = []
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue // Skip the center cell
      
      const newCoord = { x: coord.x + dx, y: coord.y + dy }
      if (isValidCoordinate(newCoord, width, height)) {
        adjacent.push(newCoord)
      }
    }
  }
  
  return adjacent
}

// Convert 2D coordinates to 1D index
export const coordinateToIndex = (coord: Coordinate, width: number): number => {
  return coord.y * width + coord.x
}

// Convert 1D index to 2D coordinates
export const indexToCoordinate = (index: number, width: number): Coordinate => {
  return {
    x: index % width,
    y: Math.floor(index / width)
  }
}

// Create a deep copy of a 2D cell array
export const cloneBoard = (board: Cell[][]): Cell[][] => {
  return board.map(row => 
    row.map(cell => ({ ...cell }))
  )
}

// Generate a random integer between min and max (inclusive)
export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Shuffle an array using Fisher-Yates algorithm
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}