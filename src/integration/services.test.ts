import { DockerService } from "../services/docker.service";
import { DNSService } from "../services/dns.service";
import { TaskWorker } from "../workers/task.worker";
import { CloudflareService } from "../services/cloudflare.service";
import { IPService } from "../services/ip.service";
import { TaskType, TaskStatus } from "../models/task.model";

jest.mock("../services/cloudflare.service");
jest.mock("../services/ip.service");

describe("Service Integration", () => {
  let dnsService: DNSService;
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIPService: jest.Mocked<IPService>;

  beforeEach(() => {
    // Reset singletons
    (DNSService as any).instance = undefined;
    (TaskWorker as any).instance = undefined;

    // Setup mocks
    mockCloudflare = {
      getInstance: jest.fn().mockReturnThis(),
      getDNSRecord: jest.fn().mockResolvedValue(null),
      createDNSRecord: jest.fn().mockResolvedValue(undefined),
      updateDNSRecord: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockIPService = {
      getInstance: jest.fn().mockReturnThis(),
      getPublicIP: jest.fn().mockResolvedValue("1.2.3.4"),
    } as any;

    (CloudflareService.getInstance as jest.Mock).mockReturnValue(
      mockCloudflare
    );
    (IPService.getInstance as jest.Mock).mockReturnValue(mockIPService);

    // Initialize services
    dnsService = DNSService.getInstance();
    taskWorker = TaskWorker.getInstance();
  });

  afterEach(() => {
    taskWorker.stopProcessing();
    jest.clearAllMocks();
  });

  it("should create DNS record through service chain", async () => {
    // 1. Simulate DNS service handling a service update
    await dnsService.handleServiceUpdate("test-service", {
      "dns.cloudflare.hostname": "test.domain.com",
      "dns.cloudflare.type": "A",
    });

    // 2. Process tasks
    await taskWorker.processTasks();

    // 3. Wait for all promises to resolve
    await Promise.resolve();

    // 2. Verify task was created
    expect(mockCloudflare.getDNSRecord).toHaveBeenCalled();
    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test.domain.com",
        type: "A",
        content: "1.2.3.4",
      })
    );
  });

  it("should update existing DNS record", async () => {
    // Setup: Mock existing record
    mockCloudflare.getDNSRecord.mockResolvedValueOnce({
      id: "record123",
      type: "A",
      name: "test.domain.com",
      content: "5.6.7.8",
    });

    // Test update flow
    await dnsService.handleServiceUpdate("test-service", {
      "dns.cloudflare.hostname": "test.domain.com",
      "dns.cloudflare.type": "A",
      "dns.cloudflare.content": "1.2.3.4",
    });

    // Process tasks
    await taskWorker.processTasks();

    // Wait for all promises to resolve
    await Promise.resolve();

    expect(mockCloudflare.updateDNSRecord).toHaveBeenCalledWith(
      "record123",
      expect.objectContaining({
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
      })
    );
  });
});
