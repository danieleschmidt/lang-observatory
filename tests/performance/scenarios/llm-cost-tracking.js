import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for LLM cost tracking performance
const costTrackingErrors = new Counter('cost_tracking_errors');
const costCalculationAccuracy = new Rate('cost_calculation_accuracy');
const costAggregationLatency = new Trend('cost_aggregation_latency_ms');
const tokenCountingLatency = new Trend('token_counting_latency_ms');

export const options = {
  scenarios: {
    // High-volume cost tracking simulation
    cost_ingestion_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 50 },
        { duration: '10m', target: 100 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    
    // Burst traffic simulation for cost calculations
    cost_calculation_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '30s', target: 200 }, // Burst
        { duration: '1m', target: 50 },
        { duration: '1m', target: 10 },
      ],
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    cost_calculation_accuracy: ['rate>0.99'],
    cost_aggregation_latency_ms: ['p(95)<200'],
    token_counting_latency_ms: ['p(99)<100'],
  },
  
  ext: {
    loadimpact: {
      projectID: parseInt(__ENV.K6_PROJECT_ID) || 3000000,
      name: 'LLM Cost Tracking Performance Test',
    },
  },
};

// Test data for different LLM providers and models
const llmProviders = [
  {
    name: 'openai',
    models: ['gpt-4', 'gpt-3.5-turbo', 'text-embedding-ada-002'],
    pricing: {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'text-embedding-ada-002': { input: 0.0001, output: 0 },
    },
  },
  {
    name: 'anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    pricing: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    },
  },
  {
    name: 'google',
    models: ['gemini-pro', 'gemini-pro-vision', 'text-bison'],
    pricing: {
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-pro-vision': { input: 0.0025, output: 0.01 },
      'text-bison': { input: 0.001, output: 0.001 },
    },
  },
];

// Generate realistic LLM trace data with cost information
function generateLLMTrace() {
  const provider = llmProviders[Math.floor(Math.random() * llmProviders.length)];
  const model = provider.models[Math.floor(Math.random() * provider.models.length)];
  const inputTokens = Math.floor(Math.random() * 4000) + 100;
  const outputTokens = Math.floor(Math.random() * 2000) + 50;
  
  const pricing = provider.pricing[model];
  const expectedCost = 
    (inputTokens / 1000) * pricing.input + 
    (outputTokens / 1000) * pricing.output;
  
  return {
    trace_id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    span_id: `span_${Math.random().toString(36).substr(2, 9)}`,
    provider: provider.name,
    model: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    expected_cost: parseFloat(expectedCost.toFixed(6)),
    timestamp: new Date().toISOString(),
    duration_ms: Math.floor(Math.random() * 5000) + 500,
    request_type: Math.random() > 0.8 ? 'streaming' : 'batch',
    user_id: `user_${Math.floor(Math.random() * 1000)}`,
    project_id: `project_${Math.floor(Math.random() * 50)}`,
  };
}

// Test cost tracking ingestion endpoint
export function testCostIngestion() {
  const trace = generateLLMTrace();
  const startTime = Date.now();
  
  const response = http.post(
    `${__ENV.OPENLIT_ENDPOINT || 'http://localhost:3001'}/v1/traces`,
    JSON.stringify({
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'llm-cost-tracker' } },
            { key: 'llm.provider', value: { stringValue: trace.provider } },
            { key: 'llm.model', value: { stringValue: trace.model } },
          ],
        },
        instrumentationLibrarySpans: [{
          spans: [{
            traceId: trace.trace_id,
            spanId: trace.span_id,
            name: `llm.${trace.provider}.${trace.model}`,
            kind: 'SPAN_KIND_CLIENT',
            startTimeUnixNano: (Date.now() - trace.duration_ms) * 1000000,
            endTimeUnixNano: Date.now() * 1000000,
            attributes: [
              { key: 'llm.input_tokens', value: { intValue: trace.input_tokens } },
              { key: 'llm.output_tokens', value: { intValue: trace.output_tokens } },
              { key: 'llm.total_tokens', value: { intValue: trace.total_tokens } },
              { key: 'llm.cost.input', value: { doubleValue: (trace.input_tokens / 1000) * trace.expected_cost / trace.total_tokens * 1000 } },
              { key: 'llm.cost.output', value: { doubleValue: (trace.output_tokens / 1000) * trace.expected_cost / trace.total_tokens * 1000 } },
              { key: 'llm.cost.total', value: { doubleValue: trace.expected_cost } },
              { key: 'llm.request_type', value: { stringValue: trace.request_type } },
              { key: 'user.id', value: { stringValue: trace.user_id } },
              { key: 'project.id', value: { stringValue: trace.project_id } },
            ],
          }],
        }],
      }],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
    }
  );
  
  const ingestionLatency = Date.now() - startTime;
  tokenCountingLatency.add(ingestionLatency);
  
  const success = check(response, {
    'cost ingestion successful': (r) => r.status === 200 || r.status === 202,
    'response time acceptable': (r) => r.timings.duration < 1000,
    'no server errors': (r) => r.status < 500,
  });
  
  if (!success) {
    costTrackingErrors.add(1);
  }
  
  return { trace, response, ingestionLatency };
}

// Test cost aggregation and reporting endpoints
export function testCostAggregation() {
  const queries = [
    // Total cost by provider
    {
      name: 'cost_by_provider',
      query: 'sum by (llm_provider) (rate(llm_cost_total[5m]))',
      endpoint: '/api/v1/query',
    },
    // Cost per user over time
    {
      name: 'cost_by_user',
      query: 'sum by (user_id) (rate(llm_cost_total[1h]))',
      endpoint: '/api/v1/query',
    },
    // Model usage and costs
    {
      name: 'cost_by_model',
      query: 'sum by (llm_model) (llm_cost_total)',
      endpoint: '/api/v1/query',
    },
    // Cost efficiency metrics
    {
      name: 'cost_per_token',
      query: 'rate(llm_cost_total[5m]) / rate(llm_total_tokens[5m])',
      endpoint: '/api/v1/query',
    },
  ];
  
  queries.forEach((queryConfig) => {
    const startTime = Date.now();
    
    const response = http.get(
      `${__ENV.PROMETHEUS_ENDPOINT || 'http://localhost:9090'}${queryConfig.endpoint}?query=${encodeURIComponent(queryConfig.query)}`,
      {
        headers: { 'Accept': 'application/json' },
        timeout: '10s',
      }
    );
    
    const aggregationLatency = Date.now() - startTime;
    costAggregationLatency.add(aggregationLatency);
    
    const success = check(response, {
      [`${queryConfig.name} query successful`]: (r) => r.status === 200,
      [`${queryConfig.name} has data`]: (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.data && data.data.result && data.data.result.length > 0;
        } catch (e) {
          return false;
        }
      },
      [`${queryConfig.name} response time acceptable`]: (r) => r.timings.duration < 2000,
    });
    
    if (success) {
      costCalculationAccuracy.add(1);
    } else {
      costCalculationAccuracy.add(0);
      costTrackingErrors.add(1);
    }
  });
}

// Test cost alerting thresholds
export function testCostAlerting() {
  const alertTests = [
    {
      name: 'high_cost_per_user',
      threshold: 100, // $100 per hour
      query: 'sum by (user_id) (rate(llm_cost_total[1h])) > 100',
    },
    {
      name: 'unusual_cost_spike',
      threshold: 2, // 2x normal rate
      query: 'rate(llm_cost_total[5m]) > 2 * rate(llm_cost_total[1h] offset 1h)',
    },
    {
      name: 'cost_budget_exceeded',
      threshold: 1000, // $1000 daily budget
      query: 'sum(increase(llm_cost_total[24h])) > 1000',
    },
  ];
  
  alertTests.forEach((alert) => {
    const response = http.get(
      `${__ENV.PROMETHEUS_ENDPOINT || 'http://localhost:9090'}/api/v1/query?query=${encodeURIComponent(alert.query)}`,
      { timeout: '5s' }
    );
    
    check(response, {
      [`${alert.name} alert query works`]: (r) => r.status === 200,
      [`${alert.name} returns valid data`]: (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.status === 'success' && data.data;
        } catch (e) {
          return false;
        }
      },
    });
  });
}

// Main test execution function
export default function () {
  // Weight different test types based on realistic usage patterns
  const testType = Math.random();
  
  if (testType < 0.7) {
    // 70% cost ingestion (most common)
    testCostIngestion();
  } else if (testType < 0.9) {
    // 20% cost aggregation queries
    testCostAggregation();
  } else {
    // 10% cost alerting checks
    testCostAlerting();
  }
  
  // Realistic delay between requests
  sleep(Math.random() * 2 + 0.5);
}

// Setup function to verify endpoints are available
export function setup() {
  console.log('Setting up LLM cost tracking performance test...');
  
  // Verify OpenLIT endpoint
  const openlitHealth = http.get(`${__ENV.OPENLIT_ENDPOINT || 'http://localhost:3001'}/health`);
  console.log(`OpenLIT health check: ${openlitHealth.status}`);
  
  // Verify Prometheus endpoint
  const prometheusHealth = http.get(`${__ENV.PROMETHEUS_ENDPOINT || 'http://localhost:9090'}/-/healthy`);
  console.log(`Prometheus health check: ${prometheusHealth.status}`);
  
  return {
    openlit_ready: openlitHealth.status === 200,
    prometheus_ready: prometheusHealth.status === 200,
    test_start_time: Date.now(),
  };
}

// Teardown function to generate performance report
export function teardown(data) {
  console.log('LLM cost tracking performance test completed');
  console.log(`Test duration: ${(Date.now() - data.test_start_time) / 1000}s`);
  console.log(`OpenLIT ready: ${data.openlit_ready}`);
  console.log(`Prometheus ready: ${data.prometheus_ready}`);
}