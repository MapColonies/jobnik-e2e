import { JobnikSDK, createApiClient } from "@map-colonies/jobnik-sdk";
const jobnikManagerUrl =
  process.env.JOBNIK_MANAGER_BASE_URL || `http://localhost:8080`;

export function createJobnikSDKInstance(): JobnikSDK {
  const jobnikSDK = new JobnikSDK({
    baseUrl: jobnikManagerUrl,
    httpClientOptions: {
      agentOptions: {},
    },
  });
  return jobnikSDK;
}

export function createApi() {
  return createApiClient(jobnikManagerUrl);
}
