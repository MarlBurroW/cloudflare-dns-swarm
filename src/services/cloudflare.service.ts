import { config } from "../config/config";
import { Logger } from "../utils/logger";
import axios from "axios";

export interface DNSRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export interface CloudflareResponse {
  success: boolean;
  result: DNSRecord[];
}

export interface CloudflareError {
  code: number;
  message: string;
}

export interface CloudflareUpdateData {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}

export class CloudflareService {
  private static instance: CloudflareService;
  private logger = Logger.getInstance();
  private baseUrl = "https://api.cloudflare.com/client/v4";

  private constructor() {}

  public static getInstance(): CloudflareService {
    if (!CloudflareService.instance) {
      CloudflareService.instance = new CloudflareService();
    }
    return CloudflareService.instance;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${config.cloudflare.token}`,
      "Content-Type": "application/json",
    };
  }

  private async getZoneId(domain: string): Promise<string> {
    try {
      // Extraire le domaine racine (ex: example.com depuis sub.example.com)
      const rootDomain = domain.split(".").slice(-2).join(".");

      const response = await axios.get(`${this.baseUrl}/zones`, {
        headers: this.headers,
        params: { name: rootDomain },
      });

      if (response.data.success && response.data.result.length > 0) {
        return response.data.result[0].id;
      }
      throw new Error(`No zone found for domain ${rootDomain}`);
    } catch (error) {
      this.logger.error("Failed to get zone ID", { error, domain });
      throw error;
    }
  }

  public async createDNSRecord(record: DNSRecord): Promise<void> {
    try {
      const zoneId = await this.getZoneId(record.name);

      const response = await axios.post(
        `${this.baseUrl}/zones/${zoneId}/dns_records`,
        record,
        { headers: this.headers }
      );

      if (response.data.success) {
        this.logger.info("DNS record created successfully", { record });
      } else {
        throw new Error(response.data.errors[0].message);
      }
    } catch (error) {
      this.logger.error("Failed to create DNS record", { error, record });
      throw error;
    }
  }

  public async updateDNSRecord(
    recordId: string,
    record: DNSRecord
  ): Promise<void> {
    try {
      const zoneId = await this.getZoneId(record.name);
      const response = await axios.put(
        `${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`,
        record,
        { headers: this.headers }
      );

      if (response.data.success) {
        this.logger.info("DNS record updated successfully", { record });
      } else {
        throw new Error(response.data.errors[0].message);
      }
    } catch (error) {
      this.logger.error("Failed to update DNS record", { error, record });
      throw error;
    }
  }

  public async getDNSRecord(name: string, type: string): Promise<any | null> {
    try {
      const zoneId = await this.getZoneId(name);
      const response = await axios.get(
        `${this.baseUrl}/zones/${zoneId}/dns_records`,
        {
          headers: this.headers,
          params: { name, type },
        }
      );

      if (response.data.success && response.data.result.length > 0) {
        return response.data.result[0];
      }
      return null;
    } catch (error) {
      this.logger.error("Failed to get DNS record", { error, name, type });
      throw error;
    }
  }

  public async deleteDNSRecord(
    recordId: string,
    domain: string
  ): Promise<void> {
    try {
      const zoneId = await this.getZoneId(domain);
      const response = await axios.delete(
        `${this.baseUrl}/zones/${zoneId}/dns_records/${recordId}`,
        { headers: this.headers }
      );

      if (response.data.success) {
        this.logger.info("DNS record deleted successfully", { recordId });
      } else {
        throw new Error(response.data.errors[0].message);
      }
    } catch (error) {
      this.logger.error("Failed to delete DNS record", { error, recordId });
      throw error;
    }
  }
}
