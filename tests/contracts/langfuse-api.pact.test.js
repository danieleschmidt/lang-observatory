const { Pact } = require('@pact-foundation/pact')
const { like, term } = require('@pact-foundation/pact').Matchers
const path = require('path')
const axios = require('axios')

describe('Langfuse API Contract Tests', () => {
  let provider

  beforeAll(async () => {
    provider = new Pact({
      consumer: 'lang-observatory',
      provider: 'langfuse-api',
      port: 1234,
      log: path.resolve(process.cwd(), 'test-results', 'pact.log'),
      dir: path.resolve(process.cwd(), 'pacts'),
      logLevel: 'INFO',
      spec: 3,
    })

    await provider.setup()
  })

  afterAll(async () => {
    await provider.finalize()
  })

  afterEach(async () => {
    await provider.verify()
  })

  describe('Health Check', () => {
    test('should return health status', async () => {
      await provider.addInteraction({
        state: 'service is healthy',
        uponReceiving: 'a request for health status',
        withRequest: {
          method: 'GET',
          path: '/api/health',
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            status: like('healthy'),
            timestamp: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
              generate: '2024-01-01T12:00:00',
            }),
            version: like('0.1.0'),
          },
        },
      })

      const response = await axios.get('http://localhost:1234/api/health', {
        headers: { Accept: 'application/json' },
      })

      expect(response.status).toBe(200)
      expect(response.data.status).toBe('healthy')
    })
  })

  describe('Trace Creation', () => {
    test('should create a new trace', async () => {
      await provider.addInteraction({
        state: 'API is ready to accept traces',
        uponReceiving: 'a request to create a trace',
        withRequest: {
          method: 'POST',
          path: '/api/traces',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: like('Bearer token'),
          },
          body: {
            name: like('test-trace'),
            input: like('test input'),
            metadata: like({ model: 'gpt-4' }),
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: term({
              matcher: '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
              generate: '12345678-1234-1234-1234-123456789012',
            }),
            name: like('test-trace'),
            timestamp: term({
              matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
              generate: '2024-01-01T12:00:00',
            }),
          },
        },
      })

      const response = await axios.post(
        'http://localhost:1234/api/traces',
        {
          name: 'test-trace',
          input: 'test input',
          metadata: { model: 'gpt-4' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer token',
          },
        }
      )

      expect(response.status).toBe(201)
      expect(response.data.id).toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/)
    })
  })

  describe('Metrics Retrieval', () => {
    test('should retrieve metrics data', async () => {
      await provider.addInteraction({
        state: 'metrics data exists',
        uponReceiving: 'a request for metrics',
        withRequest: {
          method: 'GET',
          path: term({
            matcher: '/api/metrics\\?from=.*&to=.*',
            generate: '/api/metrics?from=2024-01-01&to=2024-01-02',
          }),
          headers: {
            Accept: 'application/json',
            Authorization: like('Bearer token'),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            metrics: [
              {
                name: like('token_count'),
                value: like(1000),
                timestamp: term({
                  matcher: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
                  generate: '2024-01-01T12:00:00',
                }),
              },
            ],
            total: like(1),
          },
        },
      })

      const response = await axios.get(
        'http://localhost:1234/api/metrics?from=2024-01-01&to=2024-01-02',
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer token',
          },
        }
      )

      expect(response.status).toBe(200)
      expect(response.data.metrics).toHaveLength(1)
      expect(response.data.total).toBe(1)
    })
  })
})