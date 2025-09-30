import * as api from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe, expect } from "vitest";
import { createJobnikSDKInstance, createApi } from "../infrastructure/sdk";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { propagation } from "@opentelemetry/api";

import {
  createJobData,
  createStageData,
  createTaskData,
} from "infrastructure/data";

const contextManager = new AsyncHooksContextManager();
contextManager.enable();
api.context.setGlobalContextManager(contextManager);
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

describe("wait test", () => {
  let jobnikSDK: JobnikSDK;
  let api: ApiClient;

  beforeAll(() => {
    jobnikSDK = createJobnikSDKInstance();
    api = createApi();
  });

  afterAll(() => {
    // teardown code
  });

  it("should run a wait test", async () => {
    const producer = jobnikSDK.getProducer();
    const consumer = jobnikSDK.getConsumer();
    //#region create job

    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);
    await api.PUT("/jobs/{jobId}/status", {
      body: { status: "PENDING" },
      params: { path: { jobId: job.id } },
    });

    //#endregion

    //#region create stage
    const stageSampleData = createStageData();
    const stage = await producer.createStage(job.id, stageSampleData);
    await api.PUT("/stages/{stageId}/status", {
      body: { status: "WAITING" },
      params: { path: { stageId: stage.id } },
    });

    const taskSampleData = createTaskData();
    const task = await producer.createTasks(stage.id, stage.type, [
      taskSampleData,
    ]);
    await api.PUT("/tasks/{taskId}/status", {
      body: { status: "PENDING" },
      params: { path: { taskId: task[0]!.id } },
    });
    //#endregion

    const dequeueResult = await consumer.dequeueTask(stage.type);
    expect(dequeueResult).toBeNull();

    //#region unwait stage
    await api.PUT("/stages/{stageId}/status", {
      body: { status: "PENDING" },
      params: { path: { stageId: stage.id } },
    });
    //#endregion

    //#region dequeue task after unpause
    const dequeueResultAfterUnpause = await consumer.dequeueTask(stage.type);
    expect(dequeueResultAfterUnpause).not.toBeNull();
    //#endregion
  });
});
