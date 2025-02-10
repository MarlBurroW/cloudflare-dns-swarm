import axios from "axios";
import { Logger } from "../utils/logger";

export class IPService {
  private static instance: IPService;
  private logger = Logger.getInstance();
  private currentIP: string | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): IPService {
    if (!IPService.instance) {
      IPService.instance = new IPService();
    }
    return IPService.instance;
  }

  public async getPublicIP(): Promise<string> {
    if (this.currentIP && Date.now() - this.lastCheck < this.CACHE_DURATION) {
      return this.currentIP;
    }

    try {
      const [ip1, ip2] = await Promise.all([
        this.fetchIP("https://api.ipify.org?format=json"),
        this.fetchIP("https://ifconfig.me/ip"),
      ]);

      if (ip1 === ip2) {
        this.currentIP = ip1;
        this.lastCheck = Date.now();
        return ip1;
      }

      throw new Error("IP addresses from different sources don't match");
    } catch (error) {
      this.logger.error("Failed to fetch public IP", { error });
      if (this.currentIP) {
        this.logger.warn("Using cached IP address", { ip: this.currentIP });
        return this.currentIP;
      }
      throw error;
    }
  }

  private async fetchIP(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      return typeof response.data === "string"
        ? response.data.trim()
        : response.data.ip.trim();
    } catch (error) {
      this.logger.error(`Failed to fetch IP from ${url}`, { error });
      throw error;
    }
  }
}
