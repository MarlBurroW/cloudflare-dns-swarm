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

describe("DNS Service Default Values", () => {
  let dockerService: DockerService;
  let dnsService: DNSService;
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIPService: jest.Mocked<IPService>;

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

    // Initialize services
    dockerService = DockerService.getInstance();
    dnsService = DNSService.getInstance();
    taskWorker = TaskWorker.getInstance();
  });

  it("should apply default values correctly", async () => {
    const labels = {
      "dns.cloudflare.hostname": "test.domain.com",
      // Pas de type spécifié = utilise A par défaut
      // Pas de proxied spécifié = utilise true par défaut pour type A
    };

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: config.app.defaults.recordType,
        name: "test.domain.com",
        content: "1.2.3.4", // IP fournie par le mock
        proxied: true, // Valeur par défaut pour type A
        ttl: config.app.defaults.ttl,
      })
    );
  });
});
