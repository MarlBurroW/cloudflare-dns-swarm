import { TaskWorker } from "./task.worker";
import { CloudflareService } from "../services/cloudflare.service";
import { TaskType, TaskStatus } from "../models/task.model";
import { v4 as uuidv4 } from "uuid";

jest.mock("../services/cloudflare.service");
jest.mock("uuid");

describe("TaskWorker", () => {
  let taskWorker: TaskWorker;
  let mockCloudflare: jest.Mocked<CloudflareService>;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    jest.clearAllMocks();
    (TaskWorker as any).instance = undefined;

    // Mock UUID
    (uuidv4 as jest.Mock).mockReturnValue("test-uuid");

    // Setup Cloudflare mock
    mockCloudflare = {
      getInstance: jest.fn().mockReturnThis(),
      createDNSRecord: jest.fn().mockResolvedValue(undefined),
      updateDNSRecord: jest.fn().mockResolvedValue(undefined),
      deleteDNSRecord: jest.fn().mockResolvedValue(undefined),
    } as any;

    (CloudflareService.getInstance as jest.Mock).mockReturnValue(
      mockCloudflare
    );

    taskWorker = TaskWorker.getInstance();
  });

  afterEach(() => {
    taskWorker.stopProcessing();
    process.env.NODE_ENV = "development";
  });

  describe("addTask", () => {
    it("should add task to queue", async () => {
      const task = {
        id: "test-id",
        type: TaskType.CREATE,
        status: TaskStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        data: {
          serviceName: "test-service",
          recordType: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
        },
      };

      await taskWorker.addTask(task);
      expect((taskWorker as any).tasks.get("test-id")).toEqual(task);
    });
  });

  describe("processTasks", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should process CREATE task successfully", async () => {
      const task = {
        id: "test-id",
        type: TaskType.CREATE,
        status: TaskStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        data: {
          serviceName: "test-service",
          recordType: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
        },
      };

      await taskWorker.addTask(task);
      await Promise.resolve();
      await taskWorker.processTasks();
      await Promise.resolve();

      expect(mockCloudflare.createDNSRecord).toHaveBeenCalled();
      expect(Array.from((taskWorker as any).tasks.values()).length).toBe(0);
    });

    it("should process UPDATE task successfully", async () => {
      const task = {
        id: "test-id",
        type: TaskType.UPDATE,
        status: TaskStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        data: {
          recordId: "record-123",
          serviceName: "test-service",
          recordType: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
        },
      };

      await taskWorker.addTask(task);
      await taskWorker.processTasks();

      expect(mockCloudflare.updateDNSRecord).toHaveBeenCalled();
      expect(Array.from((taskWorker as any).tasks.values()).length).toBe(0);
    });

    it("should retry failed tasks", async () => {
      const task = {
        id: "test-id",
        type: TaskType.CREATE,
        status: TaskStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
        data: {
          serviceName: "test-service",
          recordType: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
        },
      };

      mockCloudflare.createDNSRecord
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce(undefined);

      await taskWorker.addTask(task);
      await Promise.resolve();
      await taskWorker.processTasks();
      await Promise.resolve();

      expect(task.attempts).toBe(1);
      expect(task.status).toBe(TaskStatus.FAILED);

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      task.status = TaskStatus.PENDING;
      await Promise.resolve();
      await taskWorker.processTasks();
      await Promise.resolve();

      expect(mockCloudflare.createDNSRecord).toHaveBeenCalledTimes(2);
      expect(Array.from((taskWorker as any).tasks.values()).length).toBe(0);
    }, 10000);

    it("should remove task after max attempts", async () => {
      const task = {
        id: "test-id",
        type: TaskType.CREATE,
        status: TaskStatus.PENDING,
        attempts: 0,
        maxAttempts: 2,
        data: {
          serviceName: "test-service",
          recordType: "A",
          name: "test.domain.com",
          content: "1.2.3.4",
        },
      };

      mockCloudflare.createDNSRecord.mockRejectedValue(new Error("API Error"));

      await taskWorker.addTask(task);

      // First attempt
      await taskWorker.processTasks();
      expect(task.attempts).toBe(1);

      // Second attempt
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      task.status = TaskStatus.PENDING;
      await taskWorker.processTasks();
      expect(task.attempts).toBe(2);

      // Task should be removed
      expect(Array.from((taskWorker as any).tasks.values()).length).toBe(0);
    }, 10000);
  });
});
