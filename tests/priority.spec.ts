import type { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe, expect } from "vitest";
import { createJobnikSDKInstance } from "../infrastructure/sdk";
import {
  createJobData,
  createStageData,
  createTaskData,
} from "infrastructure/data";

describe("Job Priority Test", () => {
  let jobnikSDK: JobnikSDK;
  let api: ApiClient;

  beforeAll(() => {
    jobnikSDK = createJobnikSDKInstance();
    api = jobnikSDK.getApiClient();
  });

  afterAll(() => {
    // teardown code
  });

  it("should dequeue tasks from higher priority jobs first", async () => {
    const producer = jobnikSDK.getProducer();
    const consumer = jobnikSDK.getConsumer();

    // Use unique stage type to isolate this test
    const stageType = `priority-test-${Date.now()}`;

    //#region Create low priority job
    const lowPriorityJobData = { ...createJobData(), priority: "LOW" as const };
    const lowPriorityJob = await producer.createJob(lowPriorityJobData);

    expect(lowPriorityJob.priority).toBe("LOW");

    const lowPriorityStageData = { ...createStageData(), type: stageType };
    const lowPriorityStage = await producer.createStage(
      lowPriorityJob.id,
      lowPriorityStageData
    );

    const lowPriorityTaskData = createTaskData();
    const [lowPriorityTask] = await producer.createTasks(
      lowPriorityStage.id,
      lowPriorityStage.type,
      [lowPriorityTaskData]
    );
    //#endregion

    //#region Create medium priority job
    const mediumPriorityJobData = {
      ...createJobData(),
      priority: "MEDIUM" as const,
    };
    const mediumPriorityJob = await producer.createJob(mediumPriorityJobData);

    expect(mediumPriorityJob.priority).toBe("MEDIUM");

    const mediumPriorityStageData = { ...createStageData(), type: stageType };
    const mediumPriorityStage = await producer.createStage(
      mediumPriorityJob.id,
      mediumPriorityStageData
    );

    const mediumPriorityTaskData = createTaskData();
    const [mediumPriorityTask] = await producer.createTasks(
      mediumPriorityStage.id,
      mediumPriorityStage.type,
      [mediumPriorityTaskData]
    );
    //#endregion

    //#region Create very high priority job
    const veryHighPriorityJobData = {
      ...createJobData(),
      priority: "VERY_HIGH" as const,
    };
    const veryHighPriorityJob = await producer.createJob(
      veryHighPriorityJobData
    );

    expect(veryHighPriorityJob.priority).toBe("VERY_HIGH");

    const veryHighPriorityStageData = { ...createStageData(), type: stageType };
    const veryHighPriorityStage = await producer.createStage(
      veryHighPriorityJob.id,
      veryHighPriorityStageData
    );

    const veryHighPriorityTaskData = createTaskData();
    const [veryHighPriorityTask] = await producer.createTasks(
      veryHighPriorityStage.id,
      veryHighPriorityStage.type,
      [veryHighPriorityTaskData]
    );
    //#endregion

    //#region Create high priority job
    const highPriorityJobData = {
      ...createJobData(),
      priority: "HIGH" as const,
    };
    const highPriorityJob = await producer.createJob(highPriorityJobData);

    expect(highPriorityJob.priority).toBe("HIGH");

    const highPriorityStageData = { ...createStageData(), type: stageType };
    const highPriorityStage = await producer.createStage(
      highPriorityJob.id,
      highPriorityStageData
    );

    const highPriorityTaskData = createTaskData();
    const [highPriorityTask] = await producer.createTasks(
      highPriorityStage.id,
      highPriorityStage.type,
      [highPriorityTaskData]
    );
    //#endregion

    //#region Dequeue tasks and verify priority order
    // First dequeue should be VERY_HIGH
    const firstTask = await consumer.dequeueTask(stageType);

    expect(firstTask!.id).toBe(veryHighPriorityTask!.id);

    // Second dequeue should be HIGH
    const secondTask = await consumer.dequeueTask(stageType);

    expect(secondTask!.id).toBe(highPriorityTask!.id);

    // Third dequeue should be MEDIUM
    const thirdTask = await consumer.dequeueTask(stageType);

    expect(thirdTask!.id).toBe(mediumPriorityTask!.id);

    // Fourth dequeue should be LOW
    const fourthTask = await consumer.dequeueTask(stageType);

    expect(fourthTask!.id).toBe(lowPriorityTask!.id);

    // No more tasks
    const noTask = await consumer.dequeueTask(stageType);
    expect(noTask).toBeNull();
    //#endregion
  });
});

