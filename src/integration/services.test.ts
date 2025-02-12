import { DockerService } from "../services/docker.service";
import { DNSService } from "../services/dns.service";
import { TaskWorker } from "../workers/task.worker";
import { CloudflareService } from "../services/cloudflare.service";
import { IPService } from "../services/ip.service";
import { TaskType, TaskStatus } from "../models/task.model";

jest.mock("../services/cloudflare.service");
jest.mock("../services/ip.service");
jest.mock("dockerode");

// D'abord le mock
jest.mock("../services/docker.service");

describe("Service Integration", () => {
  let dnsService: DNSService;
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIPService: jest.Mocked<IPService>;
  let mockGetService: jest.Mock;

  beforeEach(() => {
    // Setup le mock Docker
    mockGetService = jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Spec: { Labels: {} },
      }),
    });

    (DockerService.getInstance as jest.Mock).mockReturnValue({
      getService: mockGetService,
    });

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

    // Reset les mocks
    jest.clearAllMocks();
    mockGetService.mockClear();
  });

  afterEach(() => {
    taskWorker.stopProcessing();
    jest.clearAllMocks();
  });

  it("should create DNS record through service chain", async () => {
    const labels = {
      "dns.cloudflare.hostname": "test.domain.com",
      "dns.cloudflare.type": "A",
    };

    mockGetService.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Spec: { Labels: labels },
      }),
    });

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
      })
    );
  });

  it("should update existing DNS record", async () => {
    const labels = {
      "dns.cloudflare.hostname": "test.domain.com",
      "dns.cloudflare.type": "A",
      "dns.cloudflare.content": "1.2.3.4",
    };

    // Setup le mock Docker
    mockGetService.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Spec: { Labels: labels },
      }),
    });

    // Setup: Mock existing record
    mockCloudflare.getDNSRecord.mockResolvedValueOnce({
      id: "record123",
      type: "A",
      name: "test.domain.com",
      content: "5.6.7.8",
    });

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

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
