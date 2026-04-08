import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    // isolatedModules: true skips full type-checking so pre-existing TS errors
    // in unrelated service files don't block our test suite from running.
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 15000,
};

export default config;
