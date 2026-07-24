import { afterAll, beforeAll } from 'vitest'
import { setupTestMocks, teardownTestMocks } from './mocks'

// Global test setup — runs before all test files
beforeAll(() => {
  setupTestMocks()
})

afterAll(() => {
  teardownTestMocks()
})
