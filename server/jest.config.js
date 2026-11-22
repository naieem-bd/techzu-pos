/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Once per run: reset + migrate the test database.
  globalSetup: '<rootDir>/tests/global-setup.ts',
  // Runs before any test module is imported, so config sees the test database settings.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  clearMocks: true,
};
