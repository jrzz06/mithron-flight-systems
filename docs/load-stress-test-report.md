# Load and Stress Test Report

**Application:** Mithron Flight Systems  
**Environment:** http://127.0.0.1:3000 (local Next.js dev server)  
**Test period:** 2026-06-20T16:21:49.132Z → 2026-06-20T16:33:08.138Z  
**Platform:** Windows_NT 10.0.22631 (NexusLite-PC)  
**Total duration:** 600 seconds (~10 minutes)  
**Engine:** Native fetch load generator (in-process via `/api/dev/load-test`)

## 1. Objective

Evaluate application stability, responsiveness, and resource utilization under baseline, expected production, and peak concurrent user loads.

## 2. Testing Approach

Automated HTTP load testing was executed against the local Next.js server using a native fetch load generator. Each scenario sustained concurrent connections for 200 seconds across five representative storefront routes. Connections were split evenly per route (e.g. 100 total → 20 per route).

**Acceptance criteria:** p95 response time ≤ 3000 ms; error rate ≤ 1%.

## 3. Test Scenarios

| Scenario | Concurrent connections | Duration | Purpose |
|----------|------------------------|----------|---------|
| Baseline (100 concurrent users) | 100 | 200s | Normal operational load |
| Production (500 concurrent users) | 500 | 200s | Expected production load |
| Peak stress (1000 concurrent users) | 1000 | 200s | Peak / stress scenario |

## 4. Routes Tested

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/api/health` | Health API |
| `/products` | Product catalog |
| `/agriculture` | Category page |
| `/product/source-agri-kisan-drone-small-8-liter` | Product detail |

## 5. Summary Results

| Scenario | Total requests | Throughput (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error rate | Result |
|----------|----------------|--------------------|---------|---------|---------|------------|--------|
| Baseline (100 concurrent users) | 930 | 4.6 | 30604 | 33604 | 33644 | 87.2% | **FAIL** |
| Production (500 concurrent users) | 12,944 | 64.7 | 5448 | 33159 | 35184 | 100.0% | **FAIL** |
| Peak stress (1000 concurrent users) | 36,372 | 181.9 | 4720 | 34764 | 34822 | 99.8% | **FAIL** |

## 6. Detailed Results by Route

### Baseline (100 concurrent users)

| Route | Throughput (req/s) | p50 | p95 | p99 | Errors | Error rate |
|-------|--------------------|-----|-----|-----|--------|------------|
| `/` | 0.8 | 30604 | 33604 | 33639 | 154 | 100.0% |
| `/api/health` | 1.7 | 10882 | 27409 | 30231 | 14 | 4.1% |
| `/products` | 0.7 | 31899 | 33565 | 33579 | 140 | 100.0% |
| `/agriculture` | 0.8 | 30599 | 33597 | 33609 | 151 | 100.0% |
| `/product/...` | 0.7 | 31782 | 33629 | 33644 | 140 | 100.0% |

*System sample:* Memory 15626/15724 MB (**99.4%** used)

### Production (500 concurrent users)

| Route | Throughput (req/s) | p50 | p95 | p99 | Errors | Error rate |
|-------|--------------------|-----|-----|-----|--------|------------|
| `/` | 11.2 | 5441 | 31956 | 34000 | 2230 | 100.0% |
| `/api/health` | 16.9 | 5065 | 10065 | 32487 | 3372 | 100.0% |
| `/products` | 12.3 | 5379 | 32178 | 35138 | 2455 | 100.0% |
| `/agriculture` | 13.9 | 4776 | 30279 | 34011 | 2784 | 100.0% |
| `/product/...` | 10.5 | 5448 | 33160 | 34856 | 2103 | 100.0% |

*System sample:* Memory 15525/15724 MB (**98.7%** used)

### Peak stress (1000 concurrent users)

| Route | Throughput (req/s) | p50 | p95 | p99 | Errors | Error rate |
|-------|--------------------|-----|-----|-----|--------|------------|
| `/` | 28.1 | 4124 | 30717 | 34764 | 5618 | 100.0% |
| `/api/health` | 31.4 | 4569 | 30181 | 32980 | 6220 | 99.2% |
| `/products` | 36.3 | 4720 | 8214 | 30373 | 7255 | 100.0% |
| `/agriculture` | 41.2 | 4674 | 7855 | 30698 | 8234 | 100.0% |
| `/product/...` | 45.0 | 4499 | 7022 | 8235 | 8992 | 100.0% |

*System sample:* Memory 15583/15724 MB (**99.1%** used)

## 7. Metrics Evaluated

| Metric | Observation |
|--------|-------------|
| CPU Utilization | OS load average unavailable on Windows host; CPU saturation inferred from response latency growth |
| Memory Consumption | **96–99%** host memory used throughout all scenarios — critical memory pressure |
| Database Connection Usage | Supabase-backed routes exercised; health API reported **degraded** (503) when Supabase unreachable |
| Average Response Time | p50 ranged 4.5–31 s under stress; p95 frequently exceeded 30 s timeout threshold |
| Request Throughput | Peaked at ~182 req/s aggregate under 1000-connection scenario |
| Error Rate | **87–100%** — predominantly request timeouts (30 s) and connection saturation |
| Application Availability | Server remained running; storefront recovered after test completion |

## 8. Observations

- The application **remained running** throughout the full 10-minute assessment (16:21–16:33 UTC).
- Under concurrent self-load on the **dev server**, response times degraded severely — most storefront requests exceeded the 30 s timeout.
- Host memory was already at **96%+** before testing began, leaving minimal headroom for concurrent SSR workloads.
- The `/api/health` endpoint performed best at baseline (4.1% error rate) but degraded under 500+ concurrent connections.
- Peak stress (1000 connections) achieved highest throughput (~182 req/s) but with near-total timeout/error rates on SSR pages.
- **Important:** This test ran against the Next.js **development server** with in-process load generation. Production (`npm run build && npm run start`) on a properly sized host is expected to perform significantly better.

## 9. Conclusion

The platform **did not meet** the defined acceptance thresholds (p95 ≤ 3000 ms, error rate ≤ 1%) under the tested dev-server conditions. The assessment revealed **significant capacity constraints** on the current local environment — primarily memory exhaustion and dev-server overhead under concurrent SSR load.

**Recommendations before production sign-off:**
1. Re-run load test against **production build** on staging infrastructure with adequate RAM (≥ 4 GB free)
2. Use external load tool (`npm run test:load` / `tools/run-load-test.cmd`) rather than in-process self-load
3. Configure Supabase connectivity so health checks return `200 ok`
4. Set horizontal scaling or connection pooling for peak traffic above 500 concurrent users

---
*Report generated from `tools/load-test-results.json` on 2026-06-20*
