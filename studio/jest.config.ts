import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  preset: "ts-jest",
  collectCoverage: true,
  collectCoverageFrom: [
    "src/app/api/public/**/*.ts",
    "src/lib/**/*.ts",
    "!src/lib/db/client.ts",
    "!src/lib/db/migrations/**",
    "!src/lib/test/**",
  ],
  coverageReporters: ["text", "lcov", "cobertura", "json-summary"],
  coverageThreshold: {
    global: {
      statements: 0,
    },
    "./src/app/api/public/": {
      statements: 80,
    },
    "./src/lib/": {
      statements: 60,
    },
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { 
      tsconfig: "tsconfig.json",
      useESM: true,
      isolatedModules: true
    }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.module\\.css$": "<rootDir>/test/__mocks__/styleMock.ts",
    "^qrcode$": "<rootDir>/test/__mocks__/qrcode.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(jose)/)"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/"
  ],
};

export default config;
