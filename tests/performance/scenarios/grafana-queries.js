import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

export const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 5 }, // Ramp up
    { duration: '3m', target: 5 }, // Stay at 5 concurrent users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Dashboard queries can be slower
    http_req_failed: ['rate<0.05'], // Lower error tolerance
  },
};

const BASE_URL = __ENV.GRAFANA_URL || 'http://grafana-service:3000';
const API_KEY = __ENV.GRAFANA_API_KEY || 'admin:admin';

// Common dashboard queries used in LLM Observatory
const QUERIES = [
  // LLM Cost Tracking
  {
    query: 'sum(rate(llm_cost_total[5m])) by (model)',
    name: 'cost_by_model',
  },
  // Token Usage
  {
    query: 'sum(rate(llm_tokens_total[5m])) by (type)',
    name: 'token_usage',
  },
  // Request Latency
  {
    query:
      'histogram_quantile(0.95, rate(llm_request_duration_seconds_bucket[5m]))',
    name: 'request_latency_p95',
  },
  // Error Rate
  {
    query:
      'sum(rate(llm_requests_failed[5m])) / sum(rate(llm_requests_total[5m]))',
    name: 'error_rate',
  },
  // Active Users
  {
    query: 'count(count by (user_id)(increase(llm_requests_total[5m])))',
    name: 'active_users',
  },
];

export function setup() {
  return {
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    queries: QUERIES,
  };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.apiKey}`,
    'Content-Type': 'application/json',
  };

  // Test dashboard loading
  const dashboardResponse = http.get(
    `${data.baseUrl}/api/dashboards/uid/llm-overview`,
    { headers }
  );

  check(dashboardResponse, {
    'dashboard loads': r => r.status === 200,
    'dashboard response time < 1s': r => r.timings.duration < 1000,
  });

  // Test individual queries
  const query = data.queries[Math.floor(Math.random() * data.queries.length)];
  const now = Math.floor(Date.now() / 1000);
  const queryUrl = `${data.baseUrl}/api/datasources/proxy/1/api/v1/query_range`;

  const queryPayload = {
    query: query.query,
    start: now - 3600, // 1 hour ago
    end: now,
    step: 60, // 1 minute steps
  };

  const queryResponse = http.post(queryUrl, JSON.stringify(queryPayload), {
    headers,
  });

  const querySuccess = check(queryResponse, {
    'query executes': r => r.status === 200,
    'query response time acceptable': r => r.timings.duration < 2000,
    'query returns data': r => {
      try {
        const data = JSON.parse(r.body);
        return data.status === 'success';
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!querySuccess);

  // Test alerting endpoint
  const alertsResponse = http.get(`${data.baseUrl}/api/alerts`, { headers });
  check(alertsResponse, {
    'alerts endpoint responds': r => r.status === 200,
  });
}
