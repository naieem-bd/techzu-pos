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
  transform: {
    '^.+\\.ts$': 'ts-jest',
    // @scalar/* is published as ESM only. Node 22 loads it natively at runtime (require(esm)),
    // but Jest's module loader can't, so ts-jest transpiles just those .js files to CommonJS.
    '^.+\\.js$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { allowJs: true, module: 'commonjs', moduleResolution: 'node10' },
      },
    ],
  },
  // Default is to never transform node_modules; make the one exception explicit and narrow.
  transformIgnorePatterns: ['/node_modules/(?!@scalar/)'],
};
