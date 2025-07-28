# Lang Observatory API Documentation

## Overview

Lang Observatory provides several API endpoints for programmatic access to observability data, configuration, and management operations.

## Base URLs

- **Local Development**: `http://localhost:3000`
- **Staging**: `https://staging.lang-observatory.terragonlabs.com`
- **Production**: `https://lang-observatory.terragonlabs.com`

## Authentication

All API endpoints require authentication using Bearer tokens:

```bash
Authorization: Bearer <your-api-token>
```

### Getting an API Token

1. Access the Langfuse UI
2. Navigate to Settings > API Keys
3. Generate a new API key
4. Use the key in your API requests

## Core APIs

### Health Check API

#### `GET /api/health`

Returns the health status of all components.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "components": {
    "langfuse": "healthy",
    "openlit": "healthy", 
    "prometheus": "healthy",
    "grafana": "healthy"
  },
  "version": "0.1.0"
}
```

### Traces API

#### `GET /api/traces`

Retrieve traces with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of traces to return (default: 100, max: 1000)
- `offset` (optional): Offset for pagination (default: 0)
- `from` (optional): Start date (ISO 8601 format)
- `to` (optional): End date (ISO 8601 format)
- `model` (optional): Filter by model name
- `user_id` (optional): Filter by user ID

**Response:**
```json
{
  "traces": [
    {
      "id": "trace-123",
      "name": "llm-completion",
      "timestamp": "2024-01-01T12:00:00Z",
      "input": "What is the capital of France?",
      "output": "The capital of France is Paris.",
      "model": "gpt-4",
      "tokens": {
        "input": 8,
        "output": 7,
        "total": 15
      },
      "cost": 0.00045,
      "latency_ms": 1200,
      "metadata": {
        "user_id": "user-456",
        "session_id": "session-789"
      }
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

#### `POST /api/traces`

Create a new trace.

**Request Body:**
```json
{
  "name": "llm-completion",
  "input": "What is the capital of France?",
  "output": "The capital of France is Paris.",
  "model": "gpt-4",
  "tokens": {
    "input": 8,
    "output": 7
  },
  "metadata": {
    "user_id": "user-456",
    "session_id": "session-789"
  }
}
```

**Response:**
```json
{
  "id": "trace-123",
  "created_at": "2024-01-01T12:00:00Z"
}
```

### Metrics API

#### `GET /api/metrics`

Retrieve aggregated metrics.

**Query Parameters:**
- `from` (required): Start date (ISO 8601 format)
- `to` (required): End date (ISO 8601 format)
- `granularity` (optional): hour, day, week, month (default: hour)
- `metrics` (optional): Comma-separated list of metric names

**Response:**
```json
{
  "metrics": [
    {
      "name": "total_requests",
      "values": [
        {
          "timestamp": "2024-01-01T12:00:00Z",
          "value": 150
        }
      ]
    },
    {
      "name": "total_tokens",
      "values": [
        {
          "timestamp": "2024-01-01T12:00:00Z", 
          "value": 12500
        }
      ]
    },
    {
      "name": "total_cost_usd",
      "values": [
        {
          "timestamp": "2024-01-01T12:00:00Z",
          "value": 5.67
        }
      ]
    }
  ],
  "from": "2024-01-01T00:00:00Z",
  "to": "2024-01-01T23:59:59Z",
  "granularity": "hour"
}
```

### Models API

#### `GET /api/models`

Get statistics for all models.

**Response:**
```json
{
  "models": [
    {
      "name": "gpt-4",
      "total_requests": 500,
      "total_tokens": 125000,
      "total_cost_usd": 12.50,
      "avg_latency_ms": 1200,
      "error_rate": 0.02
    },
    {
      "name": "gpt-3.5-turbo", 
      "total_requests": 1500,
      "total_tokens": 300000,
      "total_cost_usd": 15.00,
      "avg_latency_ms": 800,
      "error_rate": 0.01
    }
  ]
}
```

### Users API

#### `GET /api/users/{user_id}/metrics`

Get metrics for a specific user.

**Response:**
```json
{
  "user_id": "user-456",
  "total_requests": 25,
  "total_tokens": 5000,
  "total_cost_usd": 2.50,
  "models_used": ["gpt-4", "gpt-3.5-turbo"],
  "first_request": "2024-01-01T10:00:00Z",
  "last_request": "2024-01-01T18:00:00Z"
}
```

## Configuration API

### `GET /api/config`

Get current configuration.

**Response:**
```json
{
  "retention_days": 30,
  "sampling_rate": 1.0,
  "cost_tracking_enabled": true,
  "anonymization_enabled": false,
  "data_export_enabled": true
}
```

### `PUT /api/config`

Update configuration (admin only).

**Request Body:**
```json
{
  "retention_days": 60,
  "sampling_rate": 0.8
}
```

## Export API

### `POST /api/export`

Export data in various formats.

**Request Body:**
```json
{
  "format": "csv",
  "from": "2024-01-01T00:00:00Z",
  "to": "2024-01-01T23:59:59Z",
  "include_traces": true,
  "include_metrics": true
}
```

**Response:**
```json
{
  "export_id": "export-123",
  "status": "processing",
  "estimated_completion": "2024-01-01T12:05:00Z"
}
```

### `GET /api/export/{export_id}`

Get export status and download link.

**Response:**
```json
{
  "export_id": "export-123",
  "status": "completed",
  "download_url": "https://api.lang-observatory.com/downloads/export-123.csv",
  "expires_at": "2024-01-02T12:00:00Z",
  "file_size_bytes": 1048576
}
```

## Rate Limiting

API endpoints are rate limited:
- **Free tier**: 1000 requests per hour
- **Pro tier**: 10000 requests per hour  
- **Enterprise**: Custom limits

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704110400
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request is missing required parameters",
    "details": {
      "missing_fields": ["from", "to"]
    }
  }
}
```

### Common Error Codes

- `INVALID_REQUEST` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Internal server error

## SDKs and Libraries

### Python SDK

```python
from lang_observatory import LangObservatory

client = LangObservatory(
    api_key="your-api-key",
    base_url="https://api.lang-observatory.com"
)

# Get traces
traces = client.traces.list(
    limit=100,
    from_date="2024-01-01",
    to_date="2024-01-02"
)

# Create a trace
trace = client.traces.create(
    name="llm-completion",
    input="Hello world",
    output="Hi there!",
    model="gpt-4"
)
```

### JavaScript SDK

```javascript
import { LangObservatory } from '@lang-observatory/client';

const client = new LangObservatory({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.lang-observatory.com'
});

// Get metrics
const metrics = await client.metrics.get({
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-01T23:59:59Z',
  granularity: 'hour'
});
```

## Webhooks

Register webhooks to receive real-time notifications:

### `POST /api/webhooks`

Register a webhook endpoint.

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/lang-observatory",
  "events": ["trace.created", "alert.triggered"],
  "secret": "webhook-secret-for-verification"
}
```

### Webhook Events

- `trace.created`: New trace was created
- `trace.completed`: Trace was completed
- `alert.triggered`: Alert threshold was exceeded
- `export.completed`: Data export finished

## Support

- **Documentation**: [https://docs.lang-observatory.com](https://docs.lang-observatory.com)
- **API Issues**: [GitHub Issues](https://github.com/terragon-labs/lang-observatory/issues)
- **Enterprise Support**: enterprise@terragonlabs.com