import { Logger } from "../utils/logger";
import { CloudflareService } from "../services/cloudflare.service";
import { DNSTask, TaskStatus, TaskType } from "../models/task.model";
import { config } from "../config/config";
import process from "process";

export class TaskWorker {
  private static instance: TaskWorker;
  private logger = Logger.getInstance();
  private cloudflare = CloudflareService.getInstance();
  private tasks: Map<string, DNSTask> = new Map();
  private isProcessing: boolean = false;
  private processInterval?: NodeJS.Timeout;

  private constructor() {
    if (process.env.NODE_ENV !== "test") {
      this.startProcessing();
    }
  }

  public static getInstance(): TaskWorker {
    if (!TaskWorker.instance) {
      TaskWorker.instance = new TaskWorker();
    }
    return TaskWorker.instance;
  }

  public async addTask(task: DNSTask): Promise<void> {
    this.tasks.set(task.id, task);
    this.logger.info("Task added to queue", { taskId: task.id, task });
  }

  private startProcessing(): NodeJS.Timeout {
    this.processInterval = setInterval(() => this.processTasks(), 5000);
    return this.processInterval;
  }

  public async processTasks(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.status === TaskStatus.PENDING) {
          await this.processTask(task);
        } else if (
          task.status === TaskStatus.FAILED &&
          task.attempts < task.maxAttempts
        ) {
          await this.retryTask(task);
        }
      }

      // Clean up completed tasks
      for (const [taskId, task] of this.tasks.entries()) {
        if (
          task.status === TaskStatus.COMPLETED ||
          (task.status === TaskStatus.FAILED &&
            task.attempts >= task.maxAttempts)
        ) {
          this.tasks.delete(taskId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: DNSTask): Promise<void> {
    task.status = TaskStatus.PROCESSING;
    task.attempts++;

    try {
      switch (task.type) {
        case TaskType.CREATE:
          await this.cloudflare.createDNSRecord({
            type: task.data.recordType,
            name: task.data.name,
            content: task.data.content,
            ttl: task.data.ttl || 1,
            proxied: task.data.proxied ?? true,
          });
          break;
        case TaskType.UPDATE:
          await this.cloudflare.updateDNSRecord(task.data.recordId!, {
            type: task.data.recordType,
            name: task.data.name,
            content: task.data.content,
            ttl: task.data.ttl || 1,
            proxied: task.data.proxied ?? true,
          });
          break;
        case TaskType.DELETE:
          await this.cloudflare.deleteDNSRecord(
            task.data.recordId!,
            task.data.name
          );
          break;
      }

      task.status = TaskStatus.COMPLETED;
      this.logger.info("Task completed successfully", { taskId: task.id });
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      this.logger.error("Task failed", {
        taskId: task.id,
        error,
        attempt: task.attempts,
      });
    }
  }

  private async retryTask(task: DNSTask): Promise<void> {
    const delay = config.app.retryDelay * Math.pow(2, task.attempts - 1);
    task.status = TaskStatus.PENDING;
    if (process.env.NODE_ENV !== "test") {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.logger.info("Retrying task", {
      taskId: task.id,
      attempt: task.attempts + 1,
    });
  }

  public stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = undefined;
    }
  }
}
