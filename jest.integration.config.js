module.exports = {
  transform: {
    '.(ts|tsx)': require.resolve('ts-jest/dist'),
  },
  testEnvironment: 'node',
  testRegex: '(src/.*__integration_tests__/.*\\.(test|spec))\\.(ts|tsx|js)$',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  setupFiles: ['<rootDir>/src/__tests__/config/setup.ts'],
};
