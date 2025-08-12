import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// SLO-specific metrics
const sloAvailabilityBreach = new Counter('slo_availability_breach');
const sloLatencyBreach = new Counter('slo_latency_breach');
const sloThroughputBreach = new Counter('slo_throughput_breach');
const availabilityRate = new Rate('availability_rate');
const errorBudgetConsumption = new Trend('error_budget_consumption_pct');

export const options = {
  scenarios: {
    // Continuous availability monitoring
    availability_check: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 requests per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 5,
      maxVUs: 20,
      tags: { scenario: 'availability' },
    },

    // Latency SLO validation
    latency_validation: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 25 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'latency' },
    },

    // Throughput capacity testing
    throughput_validation: {
      executor: 'ramping-arrival-rate',
      startTimeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '1m', target: 50 }, // Ramp to 50 RPS
        { duration: '2m', target: 100 }, // Sustain 100 RPS
        { duration: '2m', target: 200 }, // Stress test at 200 RPS
        { duration: '1m', target: 100 }, // Back to sustainable
        { duration: '1m', target: 0 }, // Ramp down
      ],
      tags: { scenario: 'throughput' },
    },
  },

  // SLO-based thresholds
  thresholds: {
    // Availability SLO: 99.9% uptime
    availability_rate: ['rate>0.999'],

    // Latency SLO: 95% of requests < 500ms
    'http_req_duration{scenario:latency}': ['p(95)<500'],

    // Throughput SLO: > 100 queries/second
    'http_reqs{scenario:throughput}': ['rate>100'],

    // Error budget consumption
    error_budget_consumption_pct: ['p(95)<10'], // Don't consume more than 10% of error budget

    // Overall system health
    http_req_failed: ['rate<0.001'], // 99.9% success rate
  },
};

// SLO definitions matching docs/SLO_SLI_DEFINITIONS.md
const SLO_DEFINITIONS = {
  availability: {
    target: 0.999, // 99.9%
    errorBudget: 43.8, // minutes per month
    measurement: '5m', // 5-minute windows
  },
  latency: {
    target: 500, // 500ms P95
    measurement: '5m', // 5-minute windows
    percentile: 95,
  },
  throughput: {
    target: 100, // 100 queries/second
    measurement: '5m', // 5-minute windows
  },
  dataIntegrity: {
    target: 0.995, // 99.5% complete traces
    measurement: '10m', // 10-minute windows
  },
};

// Service endpoints for SLO validation
const ENDPOINTS = {
  langfuse: __ENV.LANGFUSE_ENDPOINT || 'http://localhost:3000',
  openlit: __ENV.OPENLIT_ENDPOINT || 'http://localhost:3001',
  grafana: __ENV.GRAFANA_ENDPOINT || 'http://localhost:8080',
  prometheus: __ENV.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
};

// Test data generators
function generateTraceQuery() {
  return {
    query: 'traces',
    filters: {
      startTime: new Date(Date.now() - 3600000).toISOString(), // Last hour
      endTime: new Date().toISOString(),
      limit: Math.floor(Math.random() * 100) + 10,
    },
  };
}

function generateMetricsQuery() {
  const queries = [
    'rate(http_requests_total[5m])',
    'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    'sum(rate(traces_total[5m]))',
    'avg(llm_cost_per_request)',
  ];
  return queries[Math.floor(Math.random() * queries.length)];
}

// Availability SLO validation
export function validateAvailability() {
  const services = [
    { name: 'langfuse', url: `${ENDPOINTS.langfuse}/api/health` },
    { name: 'openlit', url: `${ENDPOINTS.openlit}/health` },
    { name: 'grafana', url: `${ENDPOINTS.grafana}/api/health` },
    { name: 'prometheus', url: `${ENDPOINTS.prometheus}/-/healthy` },
  ];

  let availableServices = 0;
  const totalServices = services.length;

  services.forEach(service => {
    const response = http.get(service.url, {
      timeout: '5s',
      tags: { service: service.name, slo: 'availability' },
    });

    const isAvailable = check(response, {
      [`${service.name} is available`]: r => r.status === 200,
      [`${service.name} responds quickly`]: r => r.timings.duration < 1000,
    });

    if (isAvailable) {
      availableServices++;
    }
  });

  const availabilityRatio = availableServices / totalServices;
  availabilityRate.add(availabilityRatio);

  // Check SLO breach
  if (availabilityRatio < SLO_DEFINITIONS.availability.target) {
    sloAvailabilityBreach.add(1);
    console.warn(
      `Availability SLO breach: ${(availabilityRatio * 100).toFixed(2)}% < ${(SLO_DEFINITIONS.availability.target * 100).toFixed(1)}%`
    );
  }

  // Calculate error budget consumption
  const errorBudgetUsed = (1 - availabilityRatio) * 100;
  errorBudgetConsumption.add(errorBudgetUsed);
}

// Latency SLO validation
export function validateLatency() {
  const testEndpoints = [
    {
      name: 'trace_query',
      url: `${ENDPOINTS.langfuse}/api/public/traces`,
      method: 'GET',
      params: generateTraceQuery(),
    },
    {
      name: 'metrics_query',
      url: `${ENDPOINTS.prometheus}/api/v1/query`,
      method: 'GET',
      params: { query: generateMetricsQuery() },
    },
    {
      name: 'dashboard_load',
      url: `${ENDPOINTS.grafana}/api/dashboards/uid/llm-overview`,
      method: 'GET',
    },
  ];

  testEndpoints.forEach(endpoint => {
    const startTime = new Date().getTime();
    const response = http.get(endpoint.url, {
      params: endpoint.params,
      timeout: '10s',
      tags: { endpoint: endpoint.name, slo: 'latency' },
    });

    const responseTime = new Date().getTime() - startTime;

    check(response, {
      [`${endpoint.name} returns successfully`]: r => r.status === 200,
      [`${endpoint.name} meets latency SLO`]: r =>
        r.timings.duration < SLO_DEFINITIONS.latency.target,
    });

    // Check latency SLO breach
    if (responseTime > SLO_DEFINITIONS.latency.target) {
      sloLatencyBreach.add(1);
      console.warn(
        `Latency SLO breach for ${endpoint.name}: ${responseTime}ms > ${SLO_DEFINITIONS.latency.target}ms`
      );
    }
  });
}

// Throughput SLO validation
export function validateThroughput() {
  // Simulate multiple concurrent requests to test throughput
  const batchSize = 10;
  const requests = [];

  for (let i = 0; i < batchSize; i++) {
    requests.push(
      http.asyncRequest(
        'GET',
        `${ENDPOINTS.langfuse}/api/public/traces`,
        null,
        {
          timeout: '5s',
          tags: { slo: 'throughput', batch: 'concurrent' },
        }
      )
    );
  }

  const responses = http.batch(requests);
  const successfulRequests = responses.filter(r => r.status === 200).length;
  const successRate = successfulRequests / batchSize;

  check(
    { successRate },
    {
      'throughput batch success rate acceptable': () => successRate >= 0.95,
    }
  );

  // Calculate requests per second for this batch
  const batchDuration =
    responses.reduce((max, r) => Math.max(max, r.timings.duration), 0) / 1000;
  const actualThroughput = batchSize / batchDuration;

  if (actualThroughput < SLO_DEFINITIONS.throughput.target) {
    sloThroughputBreach.add(1);
    console.warn(
      `Throughput SLO breach: ${actualThroughput.toFixed(2)} RPS < ${SLO_DEFINITIONS.throughput.target} RPS`
    );
  }
}

// Data integrity SLO validation
export function validateDataIntegrity() {
  const response = http.get(`${ENDPOINTS.prometheus}/api/v1/query`, {
    params: {
      query: 'openlit_complete_traces_total / openlit_traces_total',
    },
    tags: { slo: 'data_integrity' },
  });

  if (response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      if (data.data && data.data.result && data.data.result.length > 0) {
        const completenessRatio = parseFloat(data.data.result[0].value[1]);

        check(
          { completenessRatio },
          {
            'data completeness meets SLO': () =>
              completenessRatio >= SLO_DEFINITIONS.dataIntegrity.target,
          }
        );

        if (completenessRatio < SLO_DEFINITIONS.dataIntegrity.target) {
          console.warn(
            `Data integrity SLO breach: ${(completenessRatio * 100).toFixed(2)}% < ${(SLO_DEFINITIONS.dataIntegrity.target * 100).toFixed(1)}%`
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse data integrity metrics:', e);
    }
  }
}

// Cost efficiency monitoring
export function validateCostEfficiency() {
  const response = http.get(`${ENDPOINTS.prometheus}/api/v1/query`, {
    params: {
      query: 'rate(model_cost_total[1h]) / rate(model_requests_total[1h])',
    },
    tags: { slo: 'cost_efficiency' },
  });

  if (response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      if (data.data && data.data.result && data.data.result.length > 0) {
        const costPerRequest = parseFloat(data.data.result[0].value[1]);
        const costThreshold = parseFloat(__ENV.COST_THRESHOLD || '0.01'); // $0.01 per request

        check(
          { costPerRequest },
          {
            'cost efficiency within threshold': () =>
              costPerRequest <= costThreshold,
          }
        );

        if (costPerRequest > costThreshold) {
          console.warn(
            `Cost efficiency breach: $${costPerRequest.toFixed(4)} > $${costThreshold.toFixed(4)} per request`
          );
        }
      }
    } catch (e) {
      console.error('Failed to parse cost efficiency metrics:', e);
    }
  }
}

// Main test execution function
export default function () {
  const scenario = __ITER % 4; // Cycle through different validations

  switch (scenario) {
    case 0:
      validateAvailability();
      break;
    case 1:
      validateLatency();
      break;
    case 2:
      validateThroughput();
      break;
    case 3:
      validateDataIntegrity();
      validateCostEfficiency();
      break;
  }

  // Realistic delay between checks
  sleep(Math.random() * 2 + 1);
}

// Setup function
export function setup() {
  console.log('Setting up SLO validation tests...');
  console.log(
    `Availability SLO: ${SLO_DEFINITIONS.availability.target * 100}%`
  );
  console.log(
    `Latency SLO: P${SLO_DEFINITIONS.latency.percentile} < ${SLO_DEFINITIONS.latency.target}ms`
  );
  console.log(`Throughput SLO: > ${SLO_DEFINITIONS.throughput.target} RPS`);
  console.log(
    `Data Integrity SLO: > ${SLO_DEFINITIONS.dataIntegrity.target * 100}%`
  );

  // Verify all endpoints are reachable
  const healthChecks = [];
  Object.entries(ENDPOINTS).forEach(([service, endpoint]) => {
    try {
      const response = http.get(`${endpoint}/health`, { timeout: '5s' });
      healthChecks.push({
        service,
        status: response.status,
        available: response.status === 200,
      });
    } catch (e) {
      healthChecks.push({
        service,
        status: 0,
        available: false,
        error: e.message,
      });
    }
  });

  console.log('Service health check results:', healthChecks);

  return {
    startTime: new Date().getTime(),
    healthChecks,
  };
}

// Teardown function
export function teardown(data) {
  const duration = (new Date().getTime() - data.startTime) / 1000;
  console.log(`SLO validation completed in ${duration}s`);

  // Generate SLO compliance report
  console.log('\n=== SLO Compliance Report ===');
  console.log(`Test Duration: ${duration}s`);
  console.log('Service Health:', data.healthChecks);

  // Summary would be generated from the metrics collected during the test
  console.log(
    'Check detailed metrics in the k6 output for SLO breach counts and error budget consumption.'
  );
}
