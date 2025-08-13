import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'], // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.LANGFUSE_URL || 'http://langfuse-service:3000';
const API_KEY = __ENV.LANGFUSE_API_KEY || 'test-key';

export function setup() {
  // Setup test data
  return {
    baseUrl: BASE_URL,
    apiKey: API_KEY,
  };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.apiKey}`,
  };

  // Test trace ingestion
  const tracePayload = {
    id: `trace-${__VU}-${__ITER}`,
    name: 'test-trace',
    userId: `user-${__VU}`,
    metadata: {
      environment: 'performance-test',
      scenario: 'langfuse-ingestion',
    },
    spans: [
      {
        id: `span-${__VU}-${__ITER}-1`,
        name: 'llm-generation',
        input: 'What is the capital of France?',
        output: 'Paris is the capital of France.',
        model: 'gpt-3.5-turbo',
        usage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
        },
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 1000).toISOString(),
      },
    ],
  };

  const response = http.post(
    `${data.baseUrl}/api/public/traces`,
    JSON.stringify(tracePayload),
    { headers }
  );

  const success = check(response, {
    'status is 200': r => r.status === 200,
    'response time < 500ms': r => r.timings.duration < 500,
    'response has id': r => JSON.parse(r.body).id !== undefined,
  });

  errorRate.add(!success);

  // Test metrics endpoint
  const metricsResponse = http.get(`${data.baseUrl}/api/public/metrics`, {
    headers,
  });
  check(metricsResponse, {
    'metrics endpoint responds': r => r.status === 200,
  });
}

export function teardown(data) {
  // Cleanup test data if needed
  console.log('Performance test completed');
}
