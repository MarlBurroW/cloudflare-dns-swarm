import { IPService } from "./ip.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("IPService", () => {
  let ipService: IPService;

  beforeEach(() => {
    ipService = IPService.getInstance();
    jest.clearAllMocks();
  });

  it("should fetch and cache public IP", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "1.2.3.4" } }) // ipify
      .mockResolvedValueOnce({ data: "1.2.3.4" }); // ifconfig.me

    const ip1 = await ipService.getPublicIP();
    expect(ip1).toBe("1.2.3.4");
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);

    // Should use cached value
    const ip2 = await ipService.getPublicIP();
    expect(ip2).toBe("1.2.3.4");
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it("should throw error if IPs don't match", async () => {
    ipService["currentIP"] = null; // Reset cache
    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "1.2.3.4" } })
      .mockResolvedValueOnce({ data: "5.6.7.8" });

    await expect(ipService.getPublicIP()).rejects.toThrow();
  });

  it("should use cached IP if fetch fails", async () => {
    // First successful fetch
    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "1.2.3.4" } })
      .mockResolvedValueOnce({ data: "1.2.3.4" });

    const ip1 = await ipService.getPublicIP();
    expect(ip1).toBe("1.2.3.4");

    // Subsequent failed fetch
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    const ip2 = await ipService.getPublicIP();
    expect(ip2).toBe("1.2.3.4");
  });

  it("should throw error if no cached IP and fetch fails", async () => {
    ipService["currentIP"] = null; // Reset cache
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    await expect(ipService.getPublicIP()).rejects.toThrow();
  });

  it("should handle different response formats", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "1.2.3.4" } }) // Object format
      .mockResolvedValueOnce({ data: "1.2.3.4" }); // String format

    const ip = await ipService.getPublicIP();
    expect(ip).toBe("1.2.3.4");
  });

  it("should refresh cache after timeout", async () => {
    jest.useFakeTimers();
    ipService["currentIP"] = null;
    ipService["lastCheck"] = 0;

    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "1.2.3.4" } })
      .mockResolvedValueOnce({ data: "1.2.3.4" });

    const ip1 = await ipService.getPublicIP();
    expect(ip1).toBe("1.2.3.4");

    jest.advanceTimersByTime(6 * 60 * 1000);
    ipService["lastCheck"] = 0; // Force cache expiration

    mockedAxios.get
      .mockResolvedValueOnce({ data: { ip: "5.6.7.8" } })
      .mockResolvedValueOnce({ data: "5.6.7.8" });

    await Promise.resolve(); // Allow micro-tasks to complete
    await Promise.resolve(); // Allow next micro-task queue
    const ip2 = await ipService.getPublicIP();
    expect(ip2).toBe("5.6.7.8");
    jest.useRealTimers();
  });
});
