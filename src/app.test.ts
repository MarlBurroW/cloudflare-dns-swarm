import { DockerService } from "./services/docker.service";
import { DNSService } from "./services/dns.service";
import { Logger } from "./utils/logger";
import { Application } from "./app";

jest.mock("./services/docker.service");
jest.mock("./services/dns.service");
jest.mock("./utils/logger");

describe("App", () => {
  let mockDockerService: jest.Mocked<DockerService>;
  let mockDNSService: jest.Mocked<DNSService>;
  let mockLogger: jest.Mocked<ReturnType<typeof Logger.getInstance>>;
  let shutdownCallback: Function;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit
    const mockExit = jest
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    // Mock process.on
    shutdownCallback = jest.fn();
    jest.spyOn(process, "on").mockImplementation((event, callback) => {
      if (event === "SIGTERM" || event === "SIGINT") {
        shutdownCallback = callback;
      }
      return process as any;
    });

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockDockerService = {
      getInstance: jest.fn().mockReturnThis(),
      startMonitoring: jest.fn(),
      on: jest.fn(),
    } as any;

    mockDNSService = {
      getInstance: jest.fn().mockReturnThis(),
      handleServiceUpdate: jest.fn().mockResolvedValue(undefined),
    } as any;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (DockerService.getInstance as jest.Mock).mockReturnValue(mockDockerService);
    (DNSService.getInstance as jest.Mock).mockReturnValue(mockDNSService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should initialize services and handle events", async () => {
    const app = new Application();
    await app.start();

    expect(mockDockerService.startMonitoring).toHaveBeenCalled();
    expect(mockDockerService.on).toHaveBeenCalledWith(
      "dns-update",
      expect.any(Function)
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      "Starting Cloudflare DNS Swarm Manager",
      {
        version: "1.0.0",
        environment: "test",
      }
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      "Application started successfully"
    );
  });

  it("should handle DNS update events correctly", async () => {
    // Mock handleServiceUpdate pour retourner une Promise
    mockDNSService.handleServiceUpdate = jest.fn().mockResolvedValue(undefined);

    const app = new Application();
    await app.start();

    const dnsUpdateCallback = mockDockerService.on.mock.calls[0][1];
    const updateData = {
      event: "create",
      service: "test-service",
      labels: { "dns.cloudflare.hostname": "test.domain.com" },
    };

    await dnsUpdateCallback(updateData);

    expect(mockDNSService.handleServiceUpdate).toHaveBeenCalledWith(
      "test-service",
      expect.any(Object)
    );
  });

  it("should handle errors during startup", async () => {
    mockDockerService.startMonitoring.mockRejectedValueOnce(
      new Error("Startup failed")
    );

    const app = new Application();
    await expect(app.start()).rejects.toThrow("Startup failed");

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to start application",
      expect.any(Object)
    );
  });

  it("should handle errors during DNS update", async () => {
    const app = new Application();
    await app.start();

    const dnsUpdateCallback = mockDockerService.on.mock.calls[0][1];
    mockDNSService.handleServiceUpdate.mockRejectedValueOnce(
      new Error("Update failed")
    );

    const updateData = {
      event: "create",
      service: "test-service",
      labels: {},
    };
    await dnsUpdateCallback(updateData);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to handle DNS update",
      expect.any(Object)
    );
  });

  it("should handle shutdown gracefully", async () => {
    const app = new Application();
    await app.start();

    // Trigger shutdown
    await shutdownCallback();

    expect(mockLogger.info).toHaveBeenCalledWith(
      "Shutting down application..."
    );
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("should handle unknown events", async () => {
    // Mock handleServiceUpdate pour retourner une Promise
    mockDNSService.handleServiceUpdate = jest.fn().mockResolvedValue(undefined);

    const app = new Application();
    await app.start();

    const dnsUpdateCallback = mockDockerService.on.mock.calls[0][1];

    const updateData = {
      event: "unknown",
      service: "test-service",
      labels: {},
    };
    await dnsUpdateCallback(updateData);

    expect(mockDNSService.handleServiceUpdate).toHaveBeenCalledWith(
      "test-service",
      expect.any(Object)
    );
  });
});
