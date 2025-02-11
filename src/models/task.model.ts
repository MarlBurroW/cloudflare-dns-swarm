export enum TaskStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum TaskType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

export interface DNSTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  data: {
    serviceName: string;
    recordType: string;
    name: string;
    content: string;
    ttl?: number;
    recordId?: string;
    proxied?: boolean;
  };
  error?: string;
}
