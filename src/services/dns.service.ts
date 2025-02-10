import { Logger } from "../utils/logger";
import { CloudflareService, DNSRecord } from "./cloudflare.service";
import { IPService } from "./ip.service";
import { TaskWorker } from "../workers/task.worker";
import { TaskType, TaskStatus, DNSTask } from "../models/task.model";
import { v4 as uuidv4 } from "uuid";

interface DNSUpdateOptions {
  serviceName: string;
  recordType?: string;
  name: string;
  content?: string;
  ttl?: number;
}

export class DNSService {
  private static instance: DNSService;
  private logger = Logger.getInstance();
  private cloudflare = CloudflareService.getInstance();
  private ipService = IPService.getInstance();
  private taskWorker = TaskWorker.getInstance();

  private constructor() {}

  public static getInstance(): DNSService {
    if (!DNSService.instance) {
      DNSService.instance = new DNSService();
    }
    return DNSService.instance;
  }

  public async handleServiceUpdate(
    serviceName: string,
    labels: { [key: string]: string }
  ): Promise<void> {
    try {
      const dnsOptions = this.parseDNSLabels(serviceName, labels);

      if (!dnsOptions.content) {
        dnsOptions.content = await this.ipService.getPublicIP();
      }
      if (!dnsOptions.recordType) {
        dnsOptions.recordType = "A";
      }

      await this.createOrUpdateDNSRecord(dnsOptions);
    } catch (error) {
      this.logger.error("Failed to handle service update", {
        error,
        serviceName,
        labels,
      });
      throw error;
    }
  }

  private async createOrUpdateDNSRecord(
    options: DNSUpdateOptions
  ): Promise<void> {
    const record: DNSRecord = {
      type: options.recordType || "A",
      name: options.name,
      content: options.content!,
      ttl: options.ttl || 1,
      proxied: true,
    };

    const existingRecord = await this.cloudflare.getDNSRecord(
      options.name,
      record.type
    );

    const task: DNSTask = {
      id: uuidv4(),
      type: existingRecord ? TaskType.UPDATE : TaskType.CREATE,
      status: TaskStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
      data: {
        serviceName: options.serviceName,
        recordType: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
      },
    };

    if (existingRecord) {
      task.data = { ...task.data, recordId: existingRecord.id };
    }

    await this.taskWorker.addTask(task);
  }

  private parseDNSLabels(
    serviceName: string,
    labels: { [key: string]: string }
  ): DNSUpdateOptions {
    const name = labels["dns.cloudflare.hostname"];
    if (!name) {
      throw new Error(
        `Service ${serviceName} is missing required dns.cloudflare.hostname label`
      );
    }

    return {
      serviceName,
      name,
      recordType: labels["dns.cloudflare.type"],
      content: labels["dns.cloudflare.content"],
      ttl: labels["dns.cloudflare.ttl"]
        ? parseInt(labels["dns.cloudflare.ttl"], 10)
        : undefined,
    };
  }

  public async handleServiceRemoval(
    serviceName: string,
    hostname: string,
    recordType: string = "A"
  ): Promise<void> {
    try {
      const record = await this.cloudflare.getDNSRecord(hostname, recordType);
      if (record) {
        const task: DNSTask = {
          id: uuidv4(),
          type: TaskType.DELETE,
          status: TaskStatus.PENDING,
          attempts: 0,
          maxAttempts: 3,
          data: {
            serviceName,
            recordType,
            name: hostname,
            content: record.content,
            recordId: record.id,
          },
        };

        await this.taskWorker.addTask(task);
      }
    } catch (error) {
      this.logger.error("Failed to handle service removal", {
        error,
        serviceName,
        hostname,
      });
      throw error;
    }
  }
}
