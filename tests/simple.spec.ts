import * as api from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe, expect } from "vitest";
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

const expectedInitialSummary = {
  pending: 1,
  inProgress: 0,
  completed: 0,
  failed: 0,
  created: 0,
  retried: 0,
  total: 1,
};

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
    const consumer = jobnikSDK.getConsumer();
    //#region create job

    const jobSampleData = createJobData();
    const job = await producer.createJob(jobSampleData);
    await api.PUT("/jobs/{jobId}/status", {
      body: { status: "PENDING" },
      params: { path: { jobId: job.id } },
    });

    //#endregion

    //#region create stage 1
    const stageSampleDataFirst = createStageData();
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
    //#endregion

    //#region create stage 2
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

    //#endregion

    //#region assert initial state
    const firstStageSummary = await api.GET("/stages/{stageId}/summary", {
      params: { path: { stageId: firstStage.id } },
    });
    expect(firstStageSummary.data).toMatchObject(expectedInitialSummary);

    const secondStageSummary = await api.GET("/stages/{stageId}/summary", {
      params: { path: { stageId: secondStage.id } },
    });
    expect(secondStageSummary.data).toMatchObject(expectedInitialSummary);

    //#endregion

    // start running the first task

    await consumer.dequeueTask(firstStage.type);

    //#region assert progress
    // validate that the first task started also progressed the stage
    const firstStageRunning = await api.GET("/stages/{stageId}", {
      params: { path: { stageId: firstStage.id } },
    });

    expect(firstStageRunning.data).toMatchObject({
      status: "IN_PROGRESS",
      summary: {
        total: 1,
        inProgress: 1,
        pending: 0,
        completed: 0,
        failed: 0,
        created: 0,
        retried: 0,
      },
    });

    const currentJob = await api.GET("/jobs/{jobId}", {
      params: { path: { jobId: job.id } },
    });

    expect(currentJob.data).toMatchObject({
      status: "IN_PROGRESS",
      percentage: 0,
    });

    //#endregion

    //#region complete first task and validate progress

    const completeFirstTaskPromise = consumer.markTaskCompleted(
      firstTask[0]!.id
    );

    await expect(completeFirstTaskPromise).resolves.not.toThrow();

    // validate first task completed also progress of stage and job
    const firstStageCompleted = await api.GET("/stages/{stageId}", {
      params: { path: { stageId: firstStage.id } },
    });

    expect(firstStageCompleted.data).toMatchObject({
      status: "COMPLETED",
      percentage: 100,
      summary: {
        total: 1,
        completed: 1,
        inProgress: 0,
        pending: 0,
        failed: 0,
        created: 0,
        retried: 0,
      },
    });
    // todo - after implement stage ordering logic. add section to validate second stage blocked until first stage completed

    //#endregion
    //todo - uncomment after implementing auto stage progression
    // const jobAfterFirstStageCompleted = await api.GET("/jobs/{jobId}", {
    //   params: { path: { jobId: job.id } },
    // });

    // expect(jobAfterFirstStageCompleted.data).toMatchObject({
    //   status: "IN_PROGRESS",
    //   percentage: 50,
    // });
  });
});
