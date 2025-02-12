import { Logger } from "../utils/logger";
import { CloudflareService, DNSRecord } from "./cloudflare.service";
import { IPService } from "./ip.service";
import { TaskWorker } from "../workers/task.worker";
import { TaskType, TaskStatus, DNSTask } from "../models/task.model";
import { v4 as uuidv4 } from "uuid";
import { LabelValidator, DNSLabel } from "../utils/validators";
import { DockerService } from "./docker.service";

interface DNSUpdateOptions {
  serviceName: string;
  recordType?: string;
  name: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
}

export class DNSService {
  private static instance: DNSService;
  private logger = Logger.getInstance();
  private cloudflare = CloudflareService.getInstance();
  private ipService = IPService.getInstance();
  private taskWorker = TaskWorker.getInstance();
  private docker = DockerService.getInstance();
  private validator = new LabelValidator();

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
    this.logger.debug("Handling service update", { serviceName, labels });

    // Récupérer le service complet pour avoir tous les labels
    const service = await this.docker.getService(serviceName);
    const serviceSpec = await service.inspect();
    const allLabels = serviceSpec.Spec.Labels || {};

    // Utiliser tous les labels pour la validation
    const dnsLabels = this.validator.validateServiceLabels(
      serviceName,
      allLabels
    );

    for (const label of dnsLabels) {
      const dnsOptions = {
        serviceName,
        name: label.hostname,
        recordType: label.type,
        content: label.content,
        ttl: label.ttl,
        proxied: label.proxied,
      };

      this.logger.debug("Processing DNS options", { dnsOptions });

      if (!dnsOptions.content) {
        this.logger.debug("No content provided, fetching public IP");
        dnsOptions.content = await this.ipService.getPublicIP();
      }

      await this.createOrUpdateDNSRecord(dnsOptions);
    }
  }

  private async createOrUpdateDNSRecord(
    options: DNSUpdateOptions
  ): Promise<void> {
    this.logger.debug("Creating/updating DNS record", { options });

    const record: DNSRecord = {
      type: options.recordType || "A",
      name: options.name,
      content: options.content!,
      ttl: options.ttl || 1,
      proxied: typeof options.proxied === "boolean" ? options.proxied : true,
    };

    const existingRecord = await this.cloudflare.getDNSRecord(
      options.name,
      record.type
    );

    if (existingRecord) {
      const needsUpdate =
        existingRecord.content !== record.content ||
        existingRecord.ttl !== record.ttl ||
        existingRecord.proxied !== record.proxied;

      if (!needsUpdate) {
        this.logger.debug("DNS record already up to date", {
          name: record.name,
          type: record.type,
          content: record.content,
          proxied: record.proxied,
        });
        return;
      }

      this.logger.info("Updating DNS record", {
        name: record.name,
        type: record.type,
        content: record.content,
        previous: existingRecord.content,
        proxied: record.proxied,
        reason: {
          contentChanged: existingRecord.content !== record.content,
          ttlChanged: existingRecord.ttl !== record.ttl,
          proxiedChanged: existingRecord.proxied !== record.proxied,
        },
      });
    } else {
      this.logger.info("Creating DNS record", {
        name: record.name,
        type: record.type,
        content: record.content,
        proxied: record.proxied,
      });
    }

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
        proxied: record.proxied,
      },
    };

    if (existingRecord) {
      task.data = { ...task.data, recordId: existingRecord.id };
    }

    this.logger.debug("Adding task to queue", { taskId: task.id, task });
    await this.taskWorker.addTask(task);
  }
}
