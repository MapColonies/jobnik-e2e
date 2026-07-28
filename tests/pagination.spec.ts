import type { ApiClient, JobnikSDK } from "@map-colonies/jobnik-sdk";
import { beforeAll, afterAll, it, describe, expect } from "vitest";
import { createJobnikSDKInstance } from "../infrastructure/sdk";
import { createJobData, createStageData } from "infrastructure/data";

describe("Pagination Tests", () => {
  let jobnikSDK: JobnikSDK;
  let api: ApiClient;

  beforeAll(() => {
    jobnikSDK = createJobnikSDKInstance();
    api = jobnikSDK.getApiClient();
  });

  afterAll(() => {
    // teardown code
  });

  it("should retrieve all stages in correct order via /jobs/{jobId}/stages", async () => {
    const producer = jobnikSDK.getProducer();

    //#region Create job with 4 stages
    const jobData = createJobData();
    const job = await producer.createJob(jobData);

    const stages: Array<{ id: string; type: string; order: number }> = [];
    for (let i = 0; i < 4; i++) {
      const stage = await producer.createStage(job.id, createStageData());
      stages.push(stage);
    }
    //#endregion

    //#region Get all stages via endpoint
    const allStages = await api.GET("/v1/jobs/{jobId}/stages", {
      params: { path: { jobId: job.id } },
    });

    expect(allStages.response.status).toBe(200);
    expect(allStages.data).toHaveLength(4);
    //#endregion

    //#region Verify stages are returned in creation order
    allStages.data!.forEach((stage, index) => {
      expect(stage.order).toBe(index + 1);
      expect(stage.id).toBe(stages[index]!.id);
      expect(stage.jobId).toBe(job.id);
    });
    //#endregion
  });

  it("should respect page_size and return correct total", async () => {
    const producer = jobnikSDK.getProducer();

    //#region Create job with 5 stages
    const jobData = createJobData();
    const job = await producer.createJob(jobData);

    for (let i = 0; i < 5; i++) {
      await producer.createStage(job.id, createStageData());
    }
    //#endregion

    //#region Request first page with page_size=2
    const page1 = await api.GET("/v1/stages", {
      params: { query: { job_id: job.id, page_size: 2, page: 1 } },
    });

    expect(page1.response.status).toBe(200);
    expect(page1.data?.total).toBe(5);
    expect(page1.data?.items).toHaveLength(2);
    //#endregion

    //#region Request second page — should have 2 items
    const page2 = await api.GET("/v1/stages", {
      params: { query: { job_id: job.id, page_size: 2, page: 2 } },
    });

    expect(page2.data?.total).toBe(5);
    expect(page2.data?.items).toHaveLength(2);
    //#endregion

    //#region Request third page — should have 1 remaining item
    const page3 = await api.GET("/v1/stages", {
      params: { query: { job_id: job.id, page_size: 2, page: 3 } },
    });

    expect(page3.data?.total).toBe(5);
    expect(page3.data?.items).toHaveLength(1);
    //#endregion
  });
});
