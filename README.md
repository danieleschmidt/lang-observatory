# lang-observatory

<!-- IMPORTANT: Replace 'your-github-username-or-org' with your actual GitHub details -->
[![Build Status](https://img.shields.io/github/actions/workflow/status/your-github-username-or-org/lang-observatory/ci.yml?branch=main)](https://github.com/your-github-username-or-org/lang-observatory/actions)
[![Coverage Status](https://img.shields.io/coveralls/github/your-github-username-or-org/lang-observatory)](https://coveralls.io/github/your-github-username-or-org/lang-observatory)
[![License](https://img.shields.io/github/license/your-github-username-or-org/lang-observatory)](LICENSE)
[![Version](https://img.shields.io/badge/version-v0.1.0-blue)](https://semver.org)

A turnkey observability stack for large language models, packaged as a Helm chart. It bundles the Langfuse UI, OpenLIT OTEL exporters, and Prometheus/Grafana to create a comprehensive, self-hostable solution for monitoring LLM applications.

## ✨ Key Features

*   **Turnkey Helm Chart**: Simplifies deployment of a complete observability stack.
*   **Integrated Tooling**: Combines Langfuse for tracing, OpenLIT for telemetry, and Grafana for visualization.
*   **Unified Root-Cause Analysis**: A Python SDK extension allows logging artifacts from other tools into the same trace.
*   **Scalable Collection**: Recommends using the OpenTelemetry Operator (or OPAMP sidecar) for auto-scaling collectors.

## ⚡ Quick Start

1.  Add the Helm repository: `helm repo add my-charts https://your-github-username-or-org.github.io/charts`
2.  Create a `values.yaml` file (see example below).
3.  Install the chart: `helm install lang-observatory my-charts/lang-observatory -f values.yaml`.

## 🛠️ Configuration Sample `values.yaml`

```yaml
langfuse:
  host: "http://langfuse-server"
  publicKey: "pk-lf-..."
  secretKey: "sk-lf-..."

openlit:
  endpoint: "otel-collector:4317"

prometheus:
  additionalScrapeConfigs:
    - job_name: 'llm-cost-tracker'
      static_configs:
        - targets: ['llm-cost-tracker-prometheus-endpoint:9090']
Use code with caution.
Markdown
📈 Roadmap
v0.1.0: Basic Helm chart with Langfuse, OpenLIT, and Grafana.
v0.2.0: Python SDK extension for unified logging.
v0.3.0: Advanced dashboarding features.
🤝 Contributing
We welcome contributions! Please see our organization-wide CONTRIBUTING.md and CODE_OF_CONDUCT.md. A CHANGELOG.md is maintained.
See Also
llm-cost-tracker: Provides the cost metrics consumed by this stack.
📝 Licenses & Attribution
This project is licensed under the Apache-2.0 License.
Langfuse: The core product is available under the MIT license. Enterprise Edition features are licensed commercially.
OpenLIT: Licensed under the Apache-2.0 License.
📚 References
Langfuse: Official Site & GitHub
OpenLIT: Official Site & GitHub
