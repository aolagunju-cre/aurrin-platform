import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  preset: "ts-jest",
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
