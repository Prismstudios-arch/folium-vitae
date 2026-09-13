module.exports = {
  // jest-expo, not "react-native": the Expo preset is what ships the
  // transformIgnorePatterns covering expo-* packages, which are published as
  // ESM and otherwise fail with "Cannot use import statement outside a module".
  preset: "jest-expo",
  roots: ["<rootDir>/src", "<rootDir>/app"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/domain/**",
    "!**/*.test.{ts,tsx}",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@tests/(.*)$": "<rootDir>/src/tests/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/build/"],
  coverageReporters: ["text", "lcov", "html"],
};
