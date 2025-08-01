# GitHub Workflows Documentation

This directory contains comprehensive documentation and templates for GitHub Actions workflows used in the Lang Observatory project.

## Overview

Lang Observatory uses a multi-stage CI/CD pipeline with security scanning, automated testing, and deployment automation. The workflows are designed to ensure code quality, security, and reliable deployments.

## Workflow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Development   │    │    Security     │    │   Deployment    │
│    Workflows    │    │   Workflows     │    │   Workflows     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • CI Pipeline   │───▶│ • Vuln Scanning │───▶│ • CD Pipeline   │
│ • Testing       │    │ • Code Analysis │    │ • Release Auto  │
│ • Linting       │    │ • Secret Scan   │    │ • Environment   │
│ • Build         │    │ • Compliance    │    │   Deployment    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Maintenance    │
                    │   Workflows     │
                    ├─────────────────┤
                    │ • Dependency    │
                    │   Updates       │
                    │ • Cleanup       │
                    │ • Monitoring    │
                    └─────────────────┘
```

## Required GitHub Actions Workflows

### 1. Continuous Integration (`ci.yml`)
**Location**: `.github/workflows/ci.yml`
**Template**: [examples/ci.yml](examples/ci.yml)

**Purpose**: Comprehensive CI pipeline for code quality and testing
- **Triggers**: Push to main, Pull requests, Manual dispatch
- **Jobs**: 
  - Linting (JavaScript, Python, YAML, Helm)
  - Testing (Unit, Integration, Helm validation)
  - Security scanning (Trivy, Kubesec, npm audit)
  - Build and packaging
  - End-to-end testing
  - Performance testing

**Requirements**:
- Node.js 20.x
- Python 3.11
- Helm 3.14+
- Docker Buildx
- kubectl for validation

### 2. Continuous Deployment (`cd.yml`)
**Location**: `.github/workflows/cd.yml`
**Template**: [examples/cd.yml](examples/cd.yml)

**Purpose**: Automated deployment and release management
- **Triggers**: Push to main, Tag creation, Manual dispatch
- **Jobs**:
  - Release creation and versioning
  - Staging deployment (automatic)
  - Production deployment (manual/tag-based)
  - Helm repository updates
  - Rollback capabilities

**Requirements**:
- `KUBE_CONFIG_STAGING`: Base64 encoded kubeconfig for staging
- `KUBE_CONFIG_PRODUCTION`: Base64 encoded kubeconfig for production
- `HELM_REPO_TOKEN`: Token for updating Helm repository

### 3. Security Scanning (`security-scan.yml`)
**Location**: `.github/workflows/security-scan.yml`
**Template**: [examples/security-scan.yml](examples/security-scan.yml)

**Purpose**: Comprehensive security analysis and vulnerability management
- **Triggers**: Push, Pull requests, Daily schedule, Manual dispatch
- **Jobs**:
  - Vulnerability scanning (Trivy - filesystem, container, Kubernetes)
  - Dependency scanning (npm audit, Python safety)
  - Secret scanning (TruffleHog, GitLeaks)
  - Static code analysis (CodeQL)
  - Kubernetes security (Kubesec, Polaris, OPA Conftest)
  - Compliance checking

**Requirements**:
- Security write permissions for SARIF uploads
- Trivy, CodeQL, and other security tools

### 4. Dependency Updates (`dependency-update.yml`)
**Location**: `.github/workflows/dependency-update.yml`
**Template**: [examples/dependency-update.yml](examples/dependency-update.yml)

**Purpose**: Automated dependency management and updates
- **Triggers**: Weekly schedule, Manual dispatch
- **Jobs**:
  - Dependency checking (npm, Python, Helm)
  - Automated updates (patch, minor, major)
  - Testing after updates
  - Pull request creation
  - Security validation

**Requirements**:
- `DEPENDENCY_UPDATE_TOKEN`: Token for creating PRs

## Workflow Templates

The `examples/` directory contains production-ready workflow templates:

- [`ci.yml`](examples/ci.yml) - Complete CI pipeline
- [`cd.yml`](examples/cd.yml) - Deployment automation
- [`security-scan.yml`](examples/security-scan.yml) - Security scanning
- [`dependency-update.yml`](examples/dependency-update.yml) - Dependency management

## Manual Setup Required

Due to GitHub App permission limitations, the following must be configured manually:

### Repository Settings

1. **General Settings**
   ```
   Repository name: lang-observatory
   Description: A turnkey observability stack for large language models
   Website: https://terragon-labs.github.io/lang-observatory
   Topics: helm, kubernetes, observability, llm, monitoring, grafana, prometheus
   ```

2. **Security Settings**
   - Enable vulnerability alerts
   - Enable Dependabot security updates
   - Enable secret scanning
   - Enable code scanning (CodeQL)

3. **Pages Settings** (if using GitHub Pages)
   - Source: Deploy from branch `gh-pages`
   - Custom domain: Optional

### Branch Protection Rules

Configure branch protection for `main` branch:

```yaml
Branch name pattern: main
Settings:
  - Require a pull request before merging
    - Require approvals: 1
    - Dismiss stale PR approvals when new commits are pushed
    - Require review from code owners
  - Require status checks to pass before merging
    - Require branches to be up to date before merging
    - Status checks:
      - ci / lint
      - ci / test (unit)
      - ci / test (integration)
      - ci / security
      - ci / build
  - Require conversation resolution before merging
  - Require signed commits
  - Restrict pushes that create files: false
  - Restrict force pushes
  - Do not allow deletions
```

### Required Secrets

Configure the following secrets in repository settings:

#### Deployment Secrets
```
KUBE_CONFIG_STAGING      # Base64 encoded kubeconfig for staging cluster
KUBE_CONFIG_PRODUCTION   # Base64 encoded kubeconfig for production cluster
HELM_REPO_TOKEN         # GitHub token for updating Helm repository
```

#### Dependency Management
```
DEPENDENCY_UPDATE_TOKEN  # GitHub token for creating dependency update PRs
```

#### Optional Integration Secrets
```
CODECOV_TOKEN           # Codecov integration token
SLACK_WEBHOOK_URL       # Slack notifications webhook
DOCKER_REGISTRY_TOKEN   # Container registry access token
```

### Environment Configuration

Create the following environments in repository settings:

#### Staging Environment
```
Name: staging
Protection rules:
  - No restrictions (auto-deploy from main)
Environment secrets:
  - KUBE_CONFIG_STAGING
Environment variables:
  - ENVIRONMENT: staging
```

#### Production Environment
```
Name: production
Protection rules:
  - Required reviewers: 1-2 maintainers
  - Deployment branches: main, tags matching v*
Environment secrets:
  - KUBE_CONFIG_PRODUCTION
Environment variables:
  - ENVIRONMENT: production
```

## Workflow File Setup Instructions

### Step 1: Create Workflow Directory
```bash
mkdir -p .github/workflows
```

### Step 2: Copy Template Files
```bash
# Copy all workflow templates
cp docs/workflows/examples/*.yml .github/workflows/

# Make them executable (if needed)
chmod +x .github/workflows/*.yml
```

### Step 3: Customize for Your Environment
1. Update registry URLs in `cd.yml`
2. Modify deployment targets and namespaces
3. Adjust resource limits and timeouts
4. Configure notification endpoints

### Step 4: Test Workflows
1. Create a test branch
2. Make a small change
3. Create a pull request
4. Verify all CI checks pass
5. Merge to test deployment pipeline

## Monitoring and Maintenance

### Workflow Health Monitoring
- Monitor workflow success rates in GitHub Actions tab
- Set up notifications for failed workflows
- Regular review of workflow performance and duration

### Maintenance Tasks
- Update action versions quarterly
- Review and update security scanning tools
- Monitor dependency update automation
- Adjust timeout values based on actual performance

### Security Considerations
- Regularly rotate access tokens
- Monitor for exposed secrets in workflow logs
- Review and audit workflow permissions
- Keep security scanning tools up to date

## Troubleshooting

### Common Issues

1. **Workflow Fails to Start**
   - Check YAML syntax
   - Verify required secrets are configured
   - Check repository permissions

2. **Test Failures**
   - Review test logs in Actions tab
   - Check service startup times
   - Verify test data and fixtures

3. **Deployment Failures**
   - Verify kubeconfig secrets
   - Check cluster connectivity
   - Review Helm chart templates

4. **Security Scan Issues**
   - Review vulnerability reports
   - Check for new security policies
   - Verify scanning tool configurations

### Getting Help

- **Workflow Issues**: Check [GitHub Actions Documentation](https://docs.github.com/en/actions)
- **Security Scanning**: Review [Security Guide](../SECURITY_CONFIGURATION.md)
- **Deployment Issues**: See [Deployment Documentation](../DEPLOYMENT.md)
- **General Support**: Create issue with `workflow` label

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Trivy Security Scanner](https://trivy.dev/)
- [CodeQL Analysis](https://codeql.github.com/)
- [Helm Documentation](https://helm.sh/docs/)