# ADR-0002: Helm Chart Architecture

## Status

Accepted

## Context

Lang-observatory needs to provide a turnkey observability stack for LLM
applications. The solution must be:

- Easy to deploy in Kubernetes environments
- Configurable for different use cases
- Maintainable and upgradeable
- Following cloud-native best practices

We need to decide on the packaging and deployment strategy for our observability
stack components.

## Decision

We will use Helm charts as our primary packaging and deployment mechanism with
the following architecture:

1. **Single umbrella chart**: One main chart that includes all components
2. **Dependency management**: Use Helm dependencies for third-party components
   (Prometheus, Grafana)
3. **Configurable components**: Allow users to enable/disable individual
   components
4. **Values-driven configuration**: Centralized configuration through
   values.yaml
5. **Template-based customization**: Use Helm templates for dynamic
   configuration

## Consequences

### Positive Consequences

- **Simplified deployment**: Single command deployment for entire stack
- **Standard packaging**: Helm is the de facto standard for Kubernetes
  applications
- **Version management**: Clear versioning and upgrade paths
- **Configuration management**: Centralized and templated configuration
- **Community integration**: Easy integration with existing Helm ecosystems
- **Rollback capability**: Built-in rollback mechanisms

### Negative Consequences

- **Helm complexity**: Users need Helm knowledge
- **Template complexity**: Complex templating logic for advanced configurations
- **Dependency management**: Managing updates to third-party chart dependencies
- **Size overhead**: Large chart with many dependencies

## Implementation

1. Create main chart in `charts/lang-observatory/`
2. Define dependencies in `Chart.yaml` for Prometheus and Grafana
3. Create comprehensive `values.yaml` with sensible defaults
4. Implement templates for custom components (Langfuse, OpenLIT)
5. Add chart testing and validation
6. Document configuration options

Chart structure:

```
charts/lang-observatory/
├── Chart.yaml              # Chart metadata and dependencies
├── values.yaml             # Default configuration values
├── templates/              # Kubernetes resource templates
│   ├── langfuse/           # Langfuse component templates
│   ├── openlit/            # OpenLIT component templates
│   ├── configmaps/         # Configuration templates
│   └── tests/              # Helm tests
└── charts/                 # Dependency charts (auto-generated)
```

## Alternatives Considered

- **Option 1**: Separate charts for each component
  - Rejected: Increases complexity for users, harder to manage dependencies
- **Option 2**: Kustomize-based deployment
  - Rejected: Less mature ecosystem, no built-in versioning
- **Option 3**: Operator-based deployment
  - Rejected: Too complex for initial version, can be added later
- **Option 4**: Docker Compose
  - Rejected: Not suitable for production Kubernetes deployments

## References

- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Kubernetes Application Guidelines](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/)
