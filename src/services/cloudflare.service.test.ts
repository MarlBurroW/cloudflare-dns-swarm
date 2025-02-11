import { CloudflareService } from "./cloudflare.service";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("CloudflareService", () => {
  let cloudflare: CloudflareService;

  beforeEach(() => {
    cloudflare = CloudflareService.getInstance();
    jest.clearAllMocks();
  });

  describe("getZoneId", () => {
    it("should extract zone ID from domain", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          result: [{ id: "zone123" }],
        },
      });

      const result = await cloudflare["getZoneId"]("sub.domain.com");
      expect(result).toBe("zone123");
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/zones"),
        expect.objectContaining({
          params: { name: "domain.com" },
        })
      );
    });

    it("should throw error if no zone found", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          result: [],
        },
      });

      await expect(cloudflare["getZoneId"]("test.com")).rejects.toThrow(
        "No zone found"
      );
    });
  });

  describe("createDNSRecord", () => {
    it("should create DNS record", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          result: [{ id: "zone123" }],
        },
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          result: { id: "record123" },
        },
      });

      await cloudflare.createDNSRecord({
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
        ttl: 1,
        proxied: true,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/zone123/dns_records",
        {
          type: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
          ttl: 1,
          proxied: true,
        },
        {
          headers: {
            Authorization: expect.any(String),
            "Content-Type": "application/json",
          },
        }
      );
    });

    it("should handle API errors", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          result: [{ id: "zone123" }],
        },
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: false,
          errors: [{ message: "Invalid record" }],
        },
      });

      await expect(
        cloudflare.createDNSRecord({
          type: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
          ttl: 1,
          proxied: true,
        })
      ).rejects.toThrow("Invalid record");
    });
  });

  describe("updateDNSRecord", () => {
    it("should update existing record", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          result: [{ id: "zone123" }],
        },
      });

      mockedAxios.put.mockResolvedValueOnce({
        data: {
          success: true,
          result: { id: "record123" },
        },
      });

      await cloudflare.updateDNSRecord("record123", {
        type: "A",
        name: "test.domain.com",
        content: "1.2.3.4",
        ttl: 1,
        proxied: true,
      });

      expect(mockedAxios.put).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/zone123/dns_records/record123",
        {
          type: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
          ttl: 1,
          proxied: true,
        },
        {
          headers: {
            Authorization: expect.any(String),
            "Content-Type": "application/json",
          },
        }
      );
    });
  });

  describe("getDNSRecord", () => {
    it("should return existing record", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: [{ id: "zone123" }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: [
              {
                id: "record123",
                type: "A",
                name: "test.domain.com",
                content: "1.2.3.4",
              },
            ],
          },
        });

      const record = await cloudflare.getDNSRecord("test.domain.com", "A");
      expect(record).toBeDefined();
      expect(record.id).toBe("record123");
    });

    it("should return null if record not found", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: [{ id: "zone123" }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            result: [],
          },
        });

      const record = await cloudflare.getDNSRecord("test.domain.com", "A");
      expect(record).toBeNull();
    });
  });
});
