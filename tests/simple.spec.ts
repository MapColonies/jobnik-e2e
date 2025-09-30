import * as api from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe } from "vitest";
import { createJobnikSDKInstance, createApi } from "../infrastructure/sdk";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { propagation, trace } from "@opentelemetry/api";

import {
  createJobData,
  createStageData,
  createTaskData,
} from "infrastructure/data";

const contextManager = new AsyncHooksContextManager();
contextManager.enable();
api.context.setGlobalContextManager(contextManager);
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

describe("simple test", () => {
  let jobnikSDK: JobnikSDK;
  let api: ApiClient;

  beforeAll(() => {
    jobnikSDK = createJobnikSDKInstance();
    api = createApi();
  });

  afterAll(() => {
    // teardown code
  });

  it("should run a simple test", async () => {
    const producer = jobnikSDK.getProducer();

    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);
    await api.PUT("/jobs/{jobId}/status", {
      body: { status: "PENDING" },
      params: { path: { jobId: job.id } },
    });

    const stageSampleDataFirst = createStageData();
    console.log(stageSampleDataFirst, "ffffff");

    const firstStage = await producer.createStage(job.id, stageSampleDataFirst);
    await api.PUT("/stages/{stageId}/status", {
      body: { status: "PENDING" },
      params: { path: { stageId: firstStage.id } },
    });

    const taskSampleDataFirst = createTaskData();
    const firstTask = await producer.createTasks(
      firstStage.id,
      firstStage.type,
      [taskSampleDataFirst]
    );
    await api.PUT("/tasks/{taskId}/status", {
      body: { status: "PENDING" },
      params: { path: { taskId: firstTask[0]!.id } },
    });

    const stageSampleDataSecond = createStageData();
    const secondStage = await producer.createStage(
      job.id,
      stageSampleDataSecond
    );
    await api.PUT("/stages/{stageId}/status", {
      body: { status: "PENDING" },
      params: { path: { stageId: secondStage.id } },
    });

    const taskSampleDataSecond = createTaskData();
    const secondTask = await producer.createTasks(
      secondStage.id,
      secondStage.type,
      [taskSampleDataSecond]
    );
    await api.PUT("/tasks/{taskId}/status", {
      body: { status: "PENDING" },
      params: { path: { taskId: secondTask[0]!.id } },
    });
  });
});
