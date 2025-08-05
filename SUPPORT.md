# Support

Welcome to the Lang Observatory support resources. This document provides
information on how to get help with the project.

## 📚 Documentation

Before seeking support, please check our comprehensive documentation:

- **[README.md](README.md)** - Project overview and quick start
- **[docs/SETUP_REQUIRED.md](docs/SETUP_REQUIRED.md)** - Manual setup
  requirements
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guide
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development setup
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture
- **[docs/API.md](docs/API.md)** - API documentation

## 🤝 Community Support

### GitHub Issues

For bug reports, feature requests, and general questions:

- **[Bug Reports](https://github.com/terragon-labs/lang-observatory/issues/new?template=bug_report.md)** -
  Report issues you've encountered
- **[Feature Requests](https://github.com/terragon-labs/lang-observatory/issues/new?template=feature_request.md)** -
  Suggest new features
- **[General Questions](https://github.com/terragon-labs/lang-observatory/issues/new)** -
  Ask questions about usage

### Discussion Forums

- **[GitHub Discussions](https://github.com/terragon-labs/lang-observatory/discussions)** -
  Community discussions, Q&A, and announcements

## 🏢 Enterprise Support

For enterprise customers and production deployments:

### Professional Services

- **Implementation consulting** - Help with deployment and customization
- **Training and workshops** - Team training on LLM observability
- **Custom integrations** - Specialized integration requirements
- **Performance optimization** - Tuning for large-scale deployments

### Support Channels

- **Email**: [support@terragonlabs.com](mailto:support@terragonlabs.com)
- **Priority support**: Available for enterprise customers
- **Response times**:
  - Critical: 4 hours
  - High: 1 business day
  - Normal: 3 business days

## 🔍 Self-Help Resources

### Troubleshooting

**Common Issues:**

1. **Chart Installation Fails**
   - Check Kubernetes version compatibility
   - Verify Helm version (3.8+)
   - Review values.yaml configuration

2. **Services Not Starting**
   - Check resource limits and requests
   - Verify dependencies (PostgreSQL, storage)
   - Review pod logs: `kubectl logs -l app=lang-observatory`

3. **Performance Issues**
   - Run performance tests: `npm run test:performance`
   - Check resource utilization
   - Review Grafana dashboards

4. **Connection Issues**
   - Verify network policies
   - Check service discovery
   - Test connectivity: `npm run test:e2e`

### Monitoring and Debugging

**Health Checks:**

```bash
# Check all services
kubectl get pods -l app=lang-observatory

# Check service health
curl http://localhost:3000/api/public/health  # Langfuse
curl http://localhost:9090/-/healthy          # Prometheus
curl http://localhost:3001/api/health         # Grafana
```

**Log Analysis:**

```bash
# View logs for troubleshooting
kubectl logs -l app=langfuse --tail=100
kubectl logs -l app=openlit --tail=100
kubectl logs -l app=prometheus --tail=100
```

## 📋 Support Request Template

When requesting support, please include:

```
**Environment:**
- Kubernetes version:
- Helm version:
- Chart version:
- Cloud provider/platform:

**Issue Description:**
[Clear description of the problem]

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Logs/Error Messages:**
[Paste relevant logs or error messages]

**Configuration:**
[Share relevant parts of values.yaml or configuration]
```

## 🛠️ Contributing Support

Help improve support resources:

- **Documentation improvements** - Submit PRs for unclear documentation
- **FAQ updates** - Add common questions and solutions
- **Example configurations** - Share working configurations
- **Troubleshooting guides** - Document solutions to common issues

## 📞 Emergency Support

For **critical production issues**:

1. **Email**: [emergency@terragonlabs.com](mailto:emergency@terragonlabs.com)
2. **Subject**: `[URGENT] Lang Observatory - [Brief Description]`
3. **Include**:
   - Severity level (Critical/High/Medium/Low)
   - Impact description
   - Current status and attempted fixes
   - Contact information for immediate response

## 🔗 Related Resources

- **[Langfuse Documentation](https://langfuse.com/docs)** - Core tracing
  platform
- **[OpenLIT Documentation](https://docs.openlit.io/)** - OTEL integration
- **[Prometheus Documentation](https://prometheus.io/docs/)** - Metrics
  collection
- **[Grafana Documentation](https://grafana.com/docs/)** - Visualization
  platform
- **[Helm Documentation](https://helm.sh/docs/)** - Package manager
- **[Kubernetes Documentation](https://kubernetes.io/docs/)** - Container
  orchestration

## 📝 Support Policies

### Response Times (Business Hours: Monday-Friday, 9 AM - 5 PM UTC)

- **Critical**: 4 hours (production down)
- **High**: 1 business day (major functionality impacted)
- **Normal**: 3 business days (general questions)
- **Low**: 5 business days (enhancement requests)

### Supported Versions

- **Current major version**: Full support
- **Previous major version**: Security updates only
- **Older versions**: Community support only

---

_This support document is regularly updated. Last updated: January 2025_
