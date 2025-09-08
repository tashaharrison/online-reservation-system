module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  transformIgnorePatterns: ["/node_modules/(?!uuid)/"],
};
