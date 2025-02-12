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

describe("Traefik Integration", () => {
  let dockerService: DockerService;
  let dnsService: DNSService;
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;
  let mockIPService: jest.Mocked<IPService>;
  let mockEventStream: EventEmitter;

  beforeEach(() => {
    // Enable Traefik integration
    config.app.useTraefikLabels = true;

    // Reset singletons
    (DockerService as any).instance = undefined;
    (DNSService as any).instance = undefined;
    (TaskWorker as any).instance = undefined;

    mockEventStream = new EventEmitter();
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

    // Reset mocks
    mockCloudflare.createDNSRecord.mockClear();
    mockCloudflare.updateDNSRecord.mockClear();
    mockCloudflare.deleteDNSRecord.mockClear();
  });

  afterEach(() => {
    taskWorker.stopProcessing();
    jest.clearAllMocks();
  });

  it("should handle basic Traefik Host rule", async () => {
    const labels = {
      "traefik.enable": "true",
      "traefik.http.routers.test.rule": "Host(`test.domain.com`)",
    };

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: config.app.defaults.recordType,
        name: "test.domain.com",
        proxied: config.app.defaults.proxied,
      })
    );
  });

  it("should handle multiple hosts in Traefik rule", async () => {
    const labels = {
      "traefik.enable": "true",
      "traefik.http.routers.test.rule":
        "Host(`test1.domain.com`) || Host(`test2.domain.com`)",
    };

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: config.app.defaults.recordType,
        name: "test1.domain.com",
        proxied: config.app.defaults.proxied,
      })
    );

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: config.app.defaults.recordType,
        name: "test2.domain.com",
        proxied: config.app.defaults.proxied,
      })
    );
  });

  it("should handle mixed DNS configurations", async () => {
    const labels = {
      "traefik.enable": "true",
      "traefik.http.routers.app.rule": "Host(`app.domain.com`)",
      "dns.cloudflare.type": "CNAME",
      "dns.cloudflare.content": "origin.domain.com",
      "dns.cloudflare.proxied": "false",
    };

    await dnsService.handleServiceUpdate("test-service", labels);
    await taskWorker.processTasks();

    expect(mockCloudflare.createDNSRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CNAME",
        name: "app.domain.com",
        content: "origin.domain.com",
        proxied: false,
      })
    );
  });
});
