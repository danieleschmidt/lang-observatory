# ADR-0003: Observability Stack Selection

## Status

Accepted

## Context

Lang-observatory needs to provide comprehensive observability for LLM
applications. The stack must support:

- LLM-specific tracing and analytics
- Traditional metrics collection and visualization
- Cost tracking and optimization
- Real-time monitoring and alerting
- Integration with existing observability tools

We need to select the core components that provide the best balance of features,
usability, and maintainability.

## Decision

We will build our observability stack on the following core components:

1. **Langfuse**: Primary LLM tracing and analytics platform
2. **OpenLIT**: OpenTelemetry-based LLM metrics collection
3. **Prometheus**: Time-series metrics storage and alerting
4. **Grafana**: Metrics visualization and dashboarding
5. **PostgreSQL**: Backend database for Langfuse

## Consequences

### Positive Consequences

- **LLM-specific observability**: Langfuse provides specialized LLM tracing
  capabilities
- **Standards compliance**: OpenLIT uses OpenTelemetry standards
- **Proven reliability**: Prometheus and Grafana are industry-standard tools
- **Comprehensive coverage**: Stack covers traces, metrics, and logs
- **Cost visibility**: Built-in cost tracking and optimization features
- **Active development**: All components have active development communities

### Negative Consequences

- **Component complexity**: Multiple components to maintain and configure
- **Resource overhead**: Requires significant compute and storage resources
- **Learning curve**: Users need to understand multiple tools
- **Dependency management**: Complex interdependencies between components

## Implementation

### Component Responsibilities

**Langfuse**:

- LLM conversation tracing
- Token usage analytics
- Cost calculation and tracking
- User session management
- A/B testing support

**OpenLIT**:

- OTEL metric collection
- Performance monitoring
- Custom LLM metrics export
- Integration with external monitoring

**Prometheus**:

- Time-series data storage
- Alert rule evaluation
- Historical data retention
- PromQL query interface

**Grafana**:

- Real-time dashboards
- Custom visualizations
- Multi-datasource correlation
- Alert management UI

**PostgreSQL**:

- Langfuse data persistence
- High-performance queries
- ACID compliance
- Backup and recovery

### Integration Points

1. **OpenLIT → Prometheus**: Metrics export via OTEL collector
2. **Langfuse → PostgreSQL**: Direct database connection
3. **Prometheus → Grafana**: Data source for dashboards
4. **Applications → Langfuse**: Direct API integration
5. **Applications → OpenLIT**: OTEL SDK integration

## Alternatives Considered

- **Option 1**: Datadog/New Relic only
  - Rejected: Vendor lock-in, high cost, limited LLM-specific features
- **Option 2**: ELK Stack (Elasticsearch, Logstash, Kibana)
  - Rejected: Primarily log-focused, lacks LLM-specific analytics
- **Option 3**: Jaeger + Custom analytics
  - Rejected: Requires significant custom development
- **Option 4**: Weights & Biases
  - Rejected: Primarily ML experiment tracking, not production observability

## References

- [Langfuse Documentation](https://langfuse.com/docs)
- [OpenLIT Documentation](https://docs.openlit.io/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/)
- [Prometheus Operator](https://prometheus-operator.dev/)
