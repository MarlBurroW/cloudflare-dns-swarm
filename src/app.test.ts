import { DockerService } from "./services/docker.service";
import { DNSService } from "./services/dns.service";

jest.mock("./services/docker.service");
jest.mock("./services/dns.service");

describe("App", () => {
  let mockDockerService: jest.Mocked<DockerService>;
  let mockDNSService: jest.Mocked<DNSService>;

  beforeEach(() => {
    mockDockerService = {
      getInstance: jest.fn().mockReturnThis(),
      startMonitoring: jest.fn(),
      on: jest.fn(),
    } as any;

    mockDNSService = {
      getInstance: jest.fn().mockReturnThis(),
      handleServiceUpdate: jest.fn(),
    } as any;

    (DockerService.getInstance as jest.Mock).mockReturnValue(mockDockerService);
    (DNSService.getInstance as jest.Mock).mockReturnValue(mockDNSService);
  });

  it("should initialize services and handle events", async () => {
    require("./app");

    expect(mockDockerService.startMonitoring).toHaveBeenCalled();
    expect(mockDockerService.on).toHaveBeenCalledWith(
      "dns-update",
      expect.any(Function)
    );
  });
});
