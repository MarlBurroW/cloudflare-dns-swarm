import { DockerService } from "./docker.service";
import Docker from "dockerode";
import { EventEmitter } from "events";
import { Service, Container, ContainerInfo } from "dockerode";

jest.mock("dockerode");

describe("DockerService", () => {
  let dockerService: DockerService;
  let mockDocker: jest.Mocked<Docker>;
  let mockEventStream: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    (DockerService as any).instance = undefined;

    mockEventStream = new EventEmitter();
    mockDocker = {
      getEvents: jest.fn().mockResolvedValue(mockEventStream),
      listServices: jest.fn(),
      listContainers: jest.fn().mockResolvedValue([]),
      getService: jest.fn(),
      getContainer: jest.fn(),
    } as any;

    (Docker as unknown as jest.Mock).mockImplementation(() => mockDocker);
    dockerService = DockerService.getInstance();
  });

  describe("startMonitoring", () => {
    it("should scan existing services in Swarm mode", async () => {
      const mockServices: Partial<Service>[] = [
        {
          Spec: {
            Name: "service1",
            Labels: {
              "dns.cloudflare.hostname": "test1.domain.com",
            },
          },
          modem: {},
          id: "service1",
        },
        {
          Spec: {
            Name: "service2",
            Labels: {
              "dns.cloudflare.hostname": "test2.domain.com",
            },
          },
        },
      ];

      mockDocker.listServices.mockResolvedValue(mockServices as Service[]);
      mockDocker.listContainers.mockResolvedValue([]);

      const dnsUpdateSpy = jest.fn();
      dockerService.on("dns-update", dnsUpdateSpy);

      await dockerService.startMonitoring();

      expect(dnsUpdateSpy).toHaveBeenCalledTimes(2);
      expect(dnsUpdateSpy).toHaveBeenCalledWith({
        event: "update",
        service: "service1",
        labels: { "dns.cloudflare.hostname": "test1.domain.com" },
      });
    });

    it("should scan existing containers in standalone mode", async () => {
      mockDocker.listServices.mockRejectedValue(new Error("Not in swarm mode"));

      const mockContainers: Partial<ContainerInfo>[] = [
        {
          Id: "container1",
          Names: ["/container1"],
          Labels: {
            "dns.cloudflare.hostname": "test1.domain.com",
          },
          Image: "nginx",
          ImageID: "image1",
          State: "running",
          Created: Date.now(),
          Command: "nginx",
          Status: "running",
        },
      ];

      mockDocker.listContainers.mockResolvedValue(
        mockContainers as ContainerInfo[]
      );

      const dnsUpdateSpy = jest.fn();
      dockerService.on("dns-update", dnsUpdateSpy);

      await dockerService.startMonitoring();

      expect(dnsUpdateSpy).toHaveBeenCalledWith({
        event: "update",
        service: "container1",
        labels: { "dns.cloudflare.hostname": "test1.domain.com" },
      });
    });

    it("should handle service events", async () => {
      await dockerService.startMonitoring();
      mockDocker.listContainers.mockResolvedValue([]);

      const dnsUpdateSpy = jest.fn();
      dockerService.on("dns-update", dnsUpdateSpy);

      const mockService = {
        Spec: {
          Name: "service1",
          Labels: {
            "dns.cloudflare.hostname": "test.domain.com",
          },
        },
      };

      mockDocker.getService.mockReturnValue({
        inspect: jest.fn().mockResolvedValue(mockService),
      } as any);

      mockEventStream.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            Type: "service",
            Action: "update",
            Actor: {
              ID: "service1",
              Attributes: {
                name: "service1",
              },
            },
          })
        )
      );

      await Promise.resolve();

      expect(dnsUpdateSpy).toHaveBeenCalledWith({
        event: "update",
        service: "service1",
        labels: { "dns.cloudflare.hostname": "test.domain.com" },
      });
    });

    it("should handle container events", async () => {
      await dockerService.startMonitoring();
      mockDocker.listContainers.mockResolvedValue([]);

      const dnsUpdateSpy = jest.fn();
      dockerService.on("dns-update", dnsUpdateSpy);

      const mockContainer = {
        Name: "/container1",
        Config: {
          Labels: {
            "dns.cloudflare.hostname": "test.domain.com",
          },
        },
        State: {
          Status: "running",
        },
      };

      mockDocker.getContainer.mockReturnValue({
        inspect: jest.fn().mockResolvedValue(mockContainer),
      } as any);

      mockEventStream.emit(
        "data",
        Buffer.from(
          JSON.stringify({
            Type: "container",
            Action: "start",
            Actor: {
              ID: "container1",
              Attributes: {
                name: "container1",
              },
            },
          })
        )
      );

      await Promise.resolve();

      expect(dnsUpdateSpy).toHaveBeenCalledWith({
        event: "start",
        service: "container1",
        labels: { "dns.cloudflare.hostname": "test.domain.com" },
      });
    });
  });
});
