# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-26

### Added

- Initial release of lang-observatory Helm chart
- Complete Langfuse deployment with authentication and secrets management
- OpenLIT OpenTelemetry collector integration for LLM telemetry
- Prometheus monitoring stack with custom LLM observability rules
- Grafana dashboards for LLM metrics visualization
- ServiceMonitor for automatic Prometheus scraping configuration
- PrometheusRule with alerting for LLM cost, error rates, and system health
- Comprehensive values.yaml with 200+ configuration options
- ServiceAccount and RBAC templates for security
- Helm chart tests for connectivity validation
- Production-ready security hardening (non-root containers, read-only
  filesystem)
- Apache 2.0 license
- Complete documentation and deployment instructions

### Features

- **Turnkey LLM Observability**: Complete stack for monitoring language model
  applications
- **Cost Tracking**: Monitor and alert on LLM usage costs per model and provider
- **Error Rate Monitoring**: Track and alert on LLM request failures
- **Performance Metrics**: Monitor response times, token usage, and throughput
- **Custom Dashboards**: Pre-built Grafana dashboards for LLM-specific metrics
- **Auto-scaling Ready**: Configurable for high-availability deployments
- **Multi-Provider Support**: Works with OpenAI, Anthropic, and other LLM
  providers

### Technical Details

- Helm chart version: 0.1.0
- Kubernetes compatibility: 1.19+
- Dependencies: Prometheus (25.8.0), Grafana (8.4.2)
- Security: RBAC enabled, secrets externalized, minimal privileges
- Testing: Automated connectivity tests included

### Getting Started

```bash
helm repo add terragon-charts https://terragon-labs.github.io/lang-observatory
helm install lang-observatory terragon-charts/lang-observatory
```

### Contributors

- Terragon Labs - Initial implementation via autonomous coding assistant

[0.1.0]: https://github.com/terragon-labs/lang-observatory/releases/tag/v0.1.0
