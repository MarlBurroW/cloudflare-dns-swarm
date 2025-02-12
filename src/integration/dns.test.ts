import { DockerService } from "../services/docker.service";
import { DNSService } from "../services/dns.service";
import { TaskWorker } from "../workers/task.worker";
import { CloudflareService } from "../services/cloudflare.service";
import { IPService } from "../services/ip.service";
import { config } from "../config/config";
import { EventEmitter } from "events";

jest.mock("../services/cloudflare.service");
jest.mock("../services/ip.service");
jest.mock("dockerode");

// Mock DockerService
jest.mock("../services/docker.service", () => ({
  DockerService: {
    getInstance: jest.fn().mockReturnValue({
      getService: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({
          Spec: { Labels: {} },
        }),
      }),
    }),
  },
}));

// Référence au mock
const mockDockerService = DockerService as jest.Mocked<typeof DockerService>;

describe("DNS Service Default Values", () => {
  let dockerService: DockerService;
  let dnsService: DNSService;
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIPService: jest.Mocked<IPService>;
  let mockGetService: jest.Mock;

  beforeEach(() => {
    // Reset singletons
    (DockerService as any).instance = undefined;
    (DNSService as any).instance = undefined;
    (TaskWorker as any).instance = undefined;

    // Configurer les valeurs par défaut pour les tests
    config.app.defaults = {
      recordType: "A",
      proxied: true,
      ttl: 1,
    };

    mockCloudflare = {
      getInstance: jest.fn().mockReturnThis(),
      getDNSRecord: jest.fn().mockResolvedValue(null),
      createDNSRecord: jest.fn().mockResolvedValue(undefined),
      updateDNSRecord: jest.fn().mockResolvedValue(undefined),
      deleteDNSRecord: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockIPService = {
      getInstance: jest.fn().mockReturnThis(),
      getPublicIP: jest.fn().mockResolvedValue("1.2.3.4"),
    } as any;

    (CloudflareService.getInstance as jest.Mock).mockReturnValue(
      mockCloudflare
    );
    (IPService.getInstance as jest.Mock).mockReturnValue(mockIPService);

    // Setup le mock Docker
    mockGetService = jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Spec: { Labels: {} },
      }),
    });

    (DockerService.getInstance as jest.Mock).mockReturnValue({
      getService: mockGetService,
    });

    // Initialize services
    dockerService = DockerService.getInstance();
    dnsService = DNSService.getInstance();
    taskWorker = TaskWorker.getInstance();
  });

  it("should apply default values correctly", async () => {
    const labels = {
      "dns.cloudflare.hostname": "test.domain.com",
    };

    // Utiliser mockGetService directement
    mockGetService.mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Spec: { Labels: labels },
      }),
    });

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: config.app.defaults.recordType,
        name: "test.domain.com",
        content: "1.2.3.4",
        proxied: true,
        ttl: config.app.defaults.ttl,
      })
    );
  });
});
