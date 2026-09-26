const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const TOTAL_REQUESTS = Number(process.env.REQUESTS ?? 10_000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const WARMUP_REQUESTS = Number(process.env.WARMUP ?? 1_000);
const VALUE = "benchmark-value";

// interface Result {
//     latency: number;
//     success: boolean;
// }

// async function request(key: string): Promise<Result> {
//     const start = performance.now();

//     try {
//         const response = await fetch(`${BASE_URL}/v1/kv/${key}`, {
//             method: "PUT",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//                 value: VALUE,
//             }),
//         });

//         const latency = performance.now() - start;

//         return {
//             latency,
//             success: response.ok,
//         };
//     } catch {
//         const latency = performance.now() - start;

//         return {
//             latency,
//             success: false,
//         };
//     }
// }

interface Result {
  latency: number;
  success: boolean;
  status?: number;
  body?: string;
  error?: string;
}

async function request(
  key: string
): Promise<Result> {
  const start = performance.now();

  try {
    const response = await fetch(
      `${BASE_URL}/v1/kv/${key}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: VALUE,
        }),
      }
    );

    const latency = performance.now() - start;

    const body = await response.text();

    return {
      latency,
      success: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    const latency = performance.now() - start;

    return {
      latency,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

async function runRequests(
    count: number,
    concurrency: number,
): Promise<Result[]> {
    const results: Result[] = [];

    let nextRequest = 0;

    async function worker(): Promise<void> {
        while (true) {
            const index = nextRequest++;
            if (index >= count) return;

            const result = await request(`benchmark-${index}`);
            results.push(result);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, count) }, () =>
        worker(),
    );
    await Promise.all(workers);
    return results;
}

function percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
}

// function printResults(results: Result[], durationMs: number): void {
//     const latencies = results.map((result) => result.latency);
//     const successful = results.filter((result) => result.success).length;
//     const errors = results.length - successful;
//     const average =
//         latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
//     const throughput = (results.length / durationMs) * 1000;

//     console.log("\nBenchmark results");
//     console.log("------------------");
//     console.log(`Requests:       ${results.length}`);
//     console.log(`Successful:     ${successful}`);
//     console.log(`Errors:         ${errors}`);
//     console.log(`Duration:       ${(durationMs / 1000).toFixed(2)} s`);
//     console.log(`Throughput:     ${throughput.toFixed(2)} req/s`);
//     console.log(`Average:        ${average.toFixed(2)} ms`);
//     console.log(`p50:            ${percentile(latencies, 50).toFixed(2)} ms`);
//     console.log(`p95:            ${percentile(latencies, 95).toFixed(2)} ms`);
//     console.log(`p99:            ${percentile(latencies, 99).toFixed(2)} ms`);
// }

function printResults(
  results: Result[],
  durationMs: number
): void {
  const latencies =
    results.map(
      (result) => result.latency
    );

  const successful =
    results.filter(
      (result) => result.success
    ).length;

  const errors =
    results.length - successful;

  const average =
    latencies.reduce(
      (sum, value) => sum + value,
      0
    ) / latencies.length;

  const throughput =
    (results.length / durationMs) * 1000;

  console.log("\nBenchmark results");
  console.log("------------------");

  console.log(
    `Requests:       ${results.length}`
  );

  console.log(
    `Successful:     ${successful}`
  );

  console.log(
    `Errors:         ${errors}`
  );

  console.log(
    `Duration:       ${(durationMs / 1000).toFixed(2)} s`
  );

  console.log(
    `Throughput:     ${throughput.toFixed(2)} req/s`
  );

  console.log(
    `Average:        ${average.toFixed(2)} ms`
  );

  console.log(
    `p50:            ${percentile(latencies, 50).toFixed(2)} ms`
  );

  console.log(
    `p95:            ${percentile(latencies, 95).toFixed(2)} ms`
  );

  console.log(
    `p99:            ${percentile(latencies, 99).toFixed(2)} ms`
  );

  const failedResults =
    results.filter(
      (result) => !result.success
    );

  if (failedResults.length > 0) {
    console.log("\nFailures");
    console.log("--------");

    const statusCounts =
      new Map<number, number>();

    for (const result of failedResults) {
      if (result.status !== undefined) {
        statusCounts.set(
          result.status,
          (statusCounts.get(result.status) ?? 0) + 1
        );
      }
    }

    for (const [status, count] of statusCounts) {
      console.log(
        `HTTP ${status}: ${count}`
      );
    }

    console.log(
      `Network errors: ${
        failedResults.filter(
          (result) =>
            result.status === undefined
        ).length
      }`
    );

    console.log("\nSample failures:");

    for (
      const result of failedResults.slice(0, 10)
    ) {
      console.log(
        JSON.stringify(result)
      );
    }
  }
}

async function main(): Promise<void> {
    console.log("GrainDB benchmark");
    console.log(`URL:         ${BASE_URL}`);
    console.log(`Requests:    ${TOTAL_REQUESTS}`);
    console.log(`Concurrency: ${CONCURRENCY}`);
    console.log(`Warmup:      ${WARMUP_REQUESTS}`);
    console.log("\nWarming up...");

    await runRequests(WARMUP_REQUESTS, CONCURRENCY);

    console.log("Warmup complete.");
    console.log("Running benchmark...");

    const start = performance.now();
    const results = await runRequests(TOTAL_REQUESTS, CONCURRENCY);
    const duration = performance.now() - start;

    printResults(results, duration);
}

await main();
