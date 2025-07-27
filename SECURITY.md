# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Lang Observatory seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Reporting Process

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: security@terragonlabs.com

Include the following information in your report:

- Type of issue (buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days with more detailed information about the issue
- **Resolution**: Security fixes will be prioritized and released as soon as possible

## Security Measures

### Code Security

- Regular dependency scanning with automated updates
- Static code analysis with CodeQL
- Container image vulnerability scanning with Trivy
- Secrets scanning with GitLeaks
- Kubernetes security policies enforcement

### Infrastructure Security

- Pod Security Standards (Restricted profile)
- Network policies for traffic isolation
- RBAC with least privilege access
- Regular security assessments
- Encrypted communication between components

### Development Security

- Signed commits enforcement
- Branch protection rules
- Required security reviews for sensitive changes
- Pre-commit hooks for security checks
- Automated security testing in CI/CD

## Security Configuration

### Kubernetes Security

The Lang Observatory Helm chart implements several security best practices:

1. **Pod Security Standards**: Enforces restricted security policies
2. **Network Policies**: Limits network communication between pods
3. **RBAC**: Implements role-based access control with minimal permissions
4. **Security Contexts**: Runs containers as non-root users
5. **Resource Limits**: Prevents resource exhaustion attacks

### Container Security

- Multi-stage Docker builds to minimize attack surface
- Non-root user execution
- Regular base image updates
- Vulnerability scanning before deployment
- Distroless or minimal base images where possible

### Data Security

- Encryption in transit for all communications
- Secure secret management
- No hardcoded credentials
- Audit logging for sensitive operations
- Data retention policies

## Security Tools

### Required Tools

Install these tools for comprehensive security scanning:

```bash
# Container vulnerability scanning
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Kubernetes security scanning
curl -sSX https://get.kubesec.io/ | sudo tee /usr/local/bin/kubesec && sudo chmod +x /usr/local/bin/kubesec

# Secrets scanning
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh
```

### Security Scanning

Run comprehensive security scans:

```bash
# All security scans
./scripts/security-scan.sh all

# Specific scans
./scripts/security-scan.sh filesystem
./scripts/security-scan.sh docker
./scripts/security-scan.sh kubernetes
./scripts/security-scan.sh secrets
./scripts/security-scan.sh dependencies
```

## Compliance

Lang Observatory follows these security standards and frameworks:

- **NIST Cybersecurity Framework**
- **CIS Kubernetes Benchmark**
- **OWASP Security Guidelines**
- **Container Security Standards**

## Security Contacts

- **Security Team**: security@terragonlabs.com
- **General Contact**: opensource@terragonlabs.com
- **Emergency**: security@terragonlabs.com (24-48 hour response)

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who report vulnerabilities to us (with their permission).

## Updates

This security policy is regularly reviewed and updated. Last updated: January 2025