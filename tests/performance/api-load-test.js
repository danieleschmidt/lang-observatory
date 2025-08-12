import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 20 }, // Ramp up to 20 users
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'], // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const endpoints = [
    '/health',
    '/metrics',
    '/api/v1/traces',
    '/api/v1/projects',
  ];

  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'k6-load-test',
      },
    });

    const result = check(response, {
      [`${endpoint} status is 200 or 404`]: r =>
        r.status === 200 || r.status === 404,
      [`${endpoint} response time < 500ms`]: r => r.timings.duration < 500,
    });

    errorRate.add(!result);
  });

  sleep(1);
}
