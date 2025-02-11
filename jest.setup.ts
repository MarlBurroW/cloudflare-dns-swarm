jest.useFakeTimers();

// Disable Winston logs during tests
process.env.LOG_LEVEL = "debug";

// Setup test environment variables
process.env.NODE_ENV = "test";
process.env.CLOUDFLARE_TOKEN = "test-token";
process.env.RETRY_ATTEMPTS = "3";
process.env.RETRY_DELAY = "300000";
process.env.IP_CHECK_INTERVAL = "3600000";

// Mock Winston logger
jest.mock("./src/utils/logger", () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));
