module.exports = {
  preset: "react-native",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/app"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/types/**",
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
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@tests/(.*)$": "<rootDir>/src/tests/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|react-native-reanimated|expo-router|expo-camera|expo-sqlite|expo-image-picker)/)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/build/"],
  coverageReporters: ["text", "lcov", "html"],
};
