import { describe, it, expect } from 'vitest'
import { DifficultyLevel, ClickType } from './index'

describe('Core Types', () => {
  it('should have correct DifficultyLevel enum values', () => {
    expect(DifficultyLevel.BEGINNER).toBe('beginner')
    expect(DifficultyLevel.INTERMEDIATE).toBe('intermediate')
    expect(DifficultyLevel.EXPERT).toBe('expert')
    expect(DifficultyLevel.CUSTOM).toBe('custom')
  })

  it('should have correct ClickType enum values', () => {
    expect(ClickType.LEFT).toBe('left')
    expect(ClickType.RIGHT).toBe('right')
    expect(ClickType.MIDDLE).toBe('middle')
  })
})