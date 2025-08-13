import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 10 },
    { duration: '2m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.1'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  let response = http.get(`${BASE_URL}/health`);

  let result = check(response, {
    'health check status is 200': r => r.status === 200,
    'health check response time < 500ms': r => r.timings.duration < 500,
  });

  errorRate.add(!result);

  response = http.get(`${BASE_URL}/metrics`);

  result = check(response, {
    'metrics endpoint status is 200': r => r.status === 200,
    'metrics response time < 1000ms': r => r.timings.duration < 1000,
  });

  errorRate.add(!result);

  sleep(1);
}
