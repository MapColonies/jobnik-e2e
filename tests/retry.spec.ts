import type { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe, expect } from "vitest";
import { createJobnikSDKInstance, createApi } from "../infrastructure/sdk";
import {
  createJobData,
  createStageData,
  createTaskData,
} from "infrastructure/data";

describe("Task Retry Test", () => {
  let jobnikSDK: JobnikSDK;
  let api: ApiClient;

  beforeAll(() => {
    jobnikSDK = createJobnikSDKInstance();
    api = jobnikSDK.getApiClient();
  });

  afterAll(() => {
    // teardown code
  });

  it("should retry failed task until max attempts reached", async () => {
    const producer = jobnikSDK.getProducer();
    const consumer = jobnikSDK.getConsumer();

    //#region Create job with stage and task with maxAttempts
    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);

    const stageData = createStageData();
    const stage = await producer.createStage(job.id, stageData);

    const taskData = { ...createTaskData(), maxAttempts: 3 };
    const [task] = await producer.createTasks(stage.id, stage.type, [taskData]);

    expect(task!.maxAttempts).toBe(3);
    expect(task!.attempts).toBe(0);
    expect(task!.status).toBe("PENDING");
    //#endregion

    //#region First attempt - dequeue and fail
    const dequeuedTask1 = await consumer.dequeueTask(stage.type);

    expect(dequeuedTask1!.id).toBe(task!.id);
    expect(dequeuedTask1!.status).toBe("IN_PROGRESS");
    expect(dequeuedTask1!.attempts).toBe(0);

    // Mark as failed
    await consumer.markTaskFailed(dequeuedTask1!.id);

    const retriedTask1 = await api.GET("/tasks/{taskId}", {
      params: { path: { taskId: task!.id } },
    });

    expect(retriedTask1.data).toMatchObject({
      status: "RETRIED",
      attempts: 1,
      maxAttempts: 3,
    });
    //#endregion

    //#region Second attempt - dequeue and fail again
    const dequeuedTask2 = await consumer.dequeueTask(stage.type);

    expect(dequeuedTask2!.id).toBe(task!.id);
    expect(dequeuedTask2!.status).toBe("IN_PROGRESS");
    expect(dequeuedTask2!.attempts).toBe(1);

    await consumer.markTaskFailed(dequeuedTask2!.id);

    const retriedTask2 = await api.GET("/tasks/{taskId}", {
      params: { path: { taskId: task!.id } },
    });

    expect(retriedTask2.data).toMatchObject({
      status: "RETRIED",
      attempts: 2,
      maxAttempts: 3,
    });
    //#endregion

    //#region Third attempt (final) - dequeue and fail, should reach FAILED state
    const dequeuedTask3 = await consumer.dequeueTask(stage.type);

    expect(dequeuedTask3!.id).toBe(task!.id);
    expect(dequeuedTask3!.status).toBe("IN_PROGRESS");
    expect(dequeuedTask3!.attempts).toBe(2);

    await consumer.markTaskFailed(dequeuedTask3!.id);

    const finalTask = await api.GET("/tasks/{taskId}", {
      params: { path: { taskId: task!.id } },
    });

    expect(finalTask.data).toMatchObject({
      status: "FAILED",
      attempts: 3,
      maxAttempts: 3,
    });
    //#endregion

    //#region Verify stage is marked as failed
    const failedStage = await api.GET("/stages/{stageId}", {
      params: { path: { stageId: stage.id } },
    });

    expect(failedStage.data).toMatchObject({
      status: "FAILED",
      summary: {
        total: 1,
        failed: 1,
        inProgress: 0,
        pending: 0,
        completed: 0,
        created: 0,
        retried: 0,
      },
    });
    //#endregion

    //#region Verify job is marked as failed
    const failedJob = await api.GET("/jobs/{jobId}", {
      params: { path: { jobId: job.id } },
    });

    expect(failedJob.data).toMatchObject({
      status: "FAILED",
    });
    //#endregion

    //#region Verify no more tasks can be dequeued
    const noTask = await consumer.dequeueTask(stage.type);
    expect(noTask).toBeNull();
    //#endregion
  });

  it("should successfully complete task after retry", async () => {
    const producer = jobnikSDK.getProducer();
    const consumer = jobnikSDK.getConsumer();

    //#region Create job with stage and task
    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);

    const stageData = createStageData();
    const stage = await producer.createStage(job.id, stageData);

    const taskData = { ...createTaskData(), maxAttempts: 3 };
    const [task] = await producer.createTasks(stage.id, stage.type, [taskData]);
    //#endregion

    //#region First attempt - fail
    const dequeuedTask1 = await consumer.dequeueTask(stage.type);
    await consumer.markTaskFailed(dequeuedTask1!.id);

    const retriedTask = await api.GET("/tasks/{taskId}", {
      params: { path: { taskId: task!.id } },
    });

    expect(retriedTask.data?.status).toBe("RETRIED");
    expect(retriedTask.data?.attempts).toBe(1);
    //#endregion

    //#region Second attempt - succeed
    const dequeuedTask2 = await consumer.dequeueTask(stage.type);

    expect(dequeuedTask2!.id).toBe(task!.id);
    expect(dequeuedTask2!.attempts).toBe(1);

    await consumer.markTaskCompleted(dequeuedTask2!.id);

    const completedTask = await api.GET("/tasks/{taskId}", {
      params: { path: { taskId: task!.id } },
    });

    expect(completedTask.data).toMatchObject({
      status: "COMPLETED",
      attempts: 1,
    });
    //#endregion

    //#region Verify stage completed
    const completedStage = await api.GET("/stages/{stageId}", {
      params: { path: { stageId: stage.id } },
    });

    expect(completedStage.data).toMatchObject({
      status: "COMPLETED",
      percentage: 100,
      summary: {
        total: 1,
        completed: 1,
        failed: 0,
        inProgress: 0,
        pending: 0,
        created: 0,
        retried: 0,
      },
    });
    //#endregion

    //#region Verify job completed
    const completedJob = await api.GET("/jobs/{jobId}", {
      params: { path: { jobId: job.id } },
    });

    expect(completedJob.data).toMatchObject({
      status: "COMPLETED",
      percentage: 100,
    });
    //#endregion
  });

  it("should handle default maxAttempts value", async () => {
    const producer = jobnikSDK.getProducer();
    const consumer = jobnikSDK.getConsumer();

    //#region Create job with stage and task without specifying maxAttempts
    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);

    const stageData = createStageData();
    const stage = await producer.createStage(job.id, stageData);

    const taskData = createTaskData();
    const [task] = await producer.createTasks(stage.id, stage.type, [taskData]);

    // System should have a default maxAttempts value (likely 3)
    expect(task!.maxAttempts).toBeGreaterThan(0);
    //#endregion

    //#region Verify task can be dequeued
    const dequeuedTask = await consumer.dequeueTask(stage.type);

    expect(dequeuedTask!.id).toBe(task!.id);
    expect(dequeuedTask!.attempts).toBe(0);
    //#endregion
  });
});
