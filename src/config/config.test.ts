import { config } from "./config";

describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      NODE_ENV: "test",
    };
    delete require.cache[require.resolve("./config")];
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it("should require CLOUDFLARE_TOKEN", () => {
    delete process.env.CLOUDFLARE_TOKEN;
    expect(() => {
      delete require.cache[require.resolve("./config")];
      require("./config");
    }).toThrow();
  });

  it("should use default values", () => {
    process.env.CLOUDFLARE_TOKEN = "test-token";
    delete require.cache[require.resolve("./config")];
    const { config } = require("./config");

    expect(config.app.retryAttempts).toBe(3);
    expect(config.app.retryDelay).toBe(300000);
    expect(config.app.ipCheckInterval).toBe(3600000);
  });

  it("should use environment variables when provided", () => {
    process.env.CLOUDFLARE_TOKEN = "test-token";
    process.env.RETRY_ATTEMPTS = "5";
    process.env.RETRY_DELAY = "60000";
    delete require.cache[require.resolve("./config")];
    const { config } = require("./config");

    expect(config.app.retryAttempts).toBe(5);
    expect(config.app.retryDelay).toBe(60000);
  });
});
