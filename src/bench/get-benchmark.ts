const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const TOTAL_REQUESTS = Number(process.env.REQUESTS ?? 10000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const WARMUP_REQUESTS = Number(process.env.WARMUP ?? 1000);

interface Result {
    latency: number;
    success: boolean;
    status?: number;
}

async function request(index: number): Promise<Result> {
    const key = `benchmark-${index % 10000}`;
    const start = performance.now();

    try {
        const response = await fetch(`${BASE_URL}/v1/kv/${key}`);
        const latency = performance.now() - start;

        return {
            latency,
            success: response.status === 200,
            status: response.status,
        };
    } catch {
        const latency = performance.now() - start;
        return {
            latency,
            success: false,
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
            const result = await request(index);
            results.push(result);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, count) }, () =>
        worker(),
    );
    await Promise.all(workers);
    return results;
}

function percentile(values: number[], percentileValue: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
}

function printResults(results: Result[], durationMs: number): void {
    const latencies = results.map((result) => result.latency);
    const successful = results.filter((result) => result.success).length;
    const errors = results.length - successful;
    const average =
        latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
    const throughput = (results.length / durationMs) * 1000;

    console.log("\nGET benchmark results");
    console.log("----------------------");
    console.log(`Requests:       ${results.length}`);
    console.log(`Successful:     ${successful}`);
    console.log(`Errors:         ${errors}`);
    console.log(`Duration:       ${(durationMs / 1000).toFixed(2)} s`);
    console.log(`Throughput:     ${throughput.toFixed(2)} req/s`);
    console.log(`Average:        ${average.toFixed(2)} ms`);
    console.log(`p50:            ${percentile(latencies, 50).toFixed(2)} ms`);
    console.log(`p95:            ${percentile(latencies, 95).toFixed(2)} ms`);
    console.log(`p99:            ${percentile(latencies, 99).toFixed(2)} ms`);

    const failed = results.filter((result) => !result.success);
    if (failed.length > 0) {
        const statusCounts = new Map<number, number>();

        for (const result of failed) {
            if (result.status !== undefined) {
                statusCounts.set(
                    result.status,
                    (statusCounts.get(result.status) ?? 0) + 1,
                );
            }
        }

        console.log("\nFailures");
        for (const [status, count] of statusCounts) {
            console.log(`HTTP ${status}: ${count}`);
        }
    }
}

async function main(): Promise<void> {
    console.log("GrainDB GET benchmark");
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
