import { TaskType, TaskStatus } from "./task.model";

describe("Task Model", () => {
  it("should have correct TaskType values", () => {
    expect(TaskType.CREATE).toBe("CREATE");
    expect(TaskType.UPDATE).toBe("UPDATE");
    expect(TaskType.DELETE).toBe("DELETE");
  });

  it("should have correct TaskStatus values", () => {
    expect(TaskStatus.PENDING).toBe("PENDING");
    expect(TaskStatus.PROCESSING).toBe("PROCESSING");
    expect(TaskStatus.COMPLETED).toBe("COMPLETED");
    expect(TaskStatus.FAILED).toBe("FAILED");
  });
});
