# 🔒 Security Configuration Guide

This document provides comprehensive security configuration guidelines for the Lang Observatory Helm chart.

## 🚨 Critical Security Requirements

### Required Secrets Configuration

All secret values must be provided explicitly. The chart will **fail to deploy** if required secrets are not configured properly.

#### Generate Required Secrets

Use the following commands to generate secure secrets:

```bash
# Generate Langfuse secrets
export NEXTAUTH_SECRET=$(openssl rand -hex 32)
export LANGFUSE_SALT=$(openssl rand -hex 32)  
export ENCRYPTION_KEY=$(openssl rand -hex 32)
export PUBLIC_KEY="pk-lf-$(openssl rand -hex 16)"
export SECRET_KEY="sk-lf-$(openssl rand -hex 32)"

# Generate database password
export DB_PASSWORD=$(openssl rand -base64 32)
```

#### Create values-secrets.yaml

**⚠️ Never commit this file to version control!**

```yaml
# values-secrets.yaml - Keep this file secure and private
langfuse:
  config:
    nextauthSecret: "${NEXTAUTH_SECRET}"
    salt: "${LANGFUSE_SALT}"
    encryptionKey: "${ENCRYPTION_KEY}"
    publicKey: "${PUBLIC_KEY}"
    secretKey: "${SECRET_KEY}"
  
  database:
    password: "${DB_PASSWORD}"
```

### Secure Deployment Process

1. **Generate secrets** using the commands above
2. **Create values-secrets.yaml** with the generated values
3. **Deploy with secrets file**:
   ```bash
   helm install lang-observatory ./charts/lang-observatory \
     -f values.yaml \
     -f values-secrets.yaml
   ```
4. **Store secrets securely** in your organization's secret management system

## 🛡️ Security Best Practices

### 1. Secret Management

#### External Secret Management (Recommended)
For production deployments, use external secret management:

```yaml
# Example with External Secrets Operator
langfuse:
  config:
    # Reference external secrets instead of inline values
    existingSecret: "langfuse-config"
    existingSecretKeys:
      nextauthSecret: "nextauth-secret"
      salt: "salt"
      encryptionKey: "encryption-key"  
      publicKey: "public-key"
      secretKey: "secret-key"
```

#### Kubernetes Secrets
If using Kubernetes secrets directly:

```bash
# Create secret manually
kubectl create secret generic langfuse-config \
  --from-literal=nextauth-secret="${NEXTAUTH_SECRET}" \
  --from-literal=salt="${LANGFUSE_SALT}" \
  --from-literal=encryption-key="${ENCRYPTION_KEY}" \
  --from-literal=public-key="${PUBLIC_KEY}" \
  --from-literal=secret-key="${SECRET_KEY}"
```

### 2. Database Security

#### TLS/SSL Configuration
Always enable TLS for database connections:

```yaml
langfuse:
  database:
    ssl: true
    sslMode: "require"
    sslCert: "/path/to/client-cert.pem"
    sslKey: "/path/to/client-key.pem" 
    sslRootCert: "/path/to/ca-cert.pem"
```

#### Network Security
Implement network policies to restrict database access:

```yaml
# Network policy example
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: langfuse-db-access
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: postgresql
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/component: langfuse
    ports:
    - protocol: TCP
      port: 5432
```

### 3. Pod Security Standards

#### Security Context Configuration
The chart implements comprehensive pod security standards:

```yaml
langfuse:
  securityContext:
    runAsNonRoot: true
    runAsUser: 65534
    runAsGroup: 65534
    fsGroup: 65534
    readOnlyRootFilesystem: true
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
```

#### Pod Security Policy
Enable pod security standards in your namespace:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: lang-observatory
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 4. Network Security

#### Ingress Security
Configure secure ingress with TLS:

```yaml
langfuse:
  ingress:
    enabled: true
    className: "nginx"
    annotations:
      cert-manager.io/cluster-issuer: "letsencrypt-prod"
      nginx.ingress.kubernetes.io/ssl-redirect: "true"
      nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    hosts:
      - host: langfuse.yourdomain.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: langfuse-tls
        hosts:
          - langfuse.yourdomain.com
```

#### Service Mesh Security
If using a service mesh (Istio, Linkerd), enable mTLS:

```yaml
# Example Istio PeerAuthentication
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: langfuse-mtls
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: langfuse
  mtls:
    mode: STRICT
```

## 🔍 Security Validation

### Pre-deployment Checks

Run these commands before deploying:

```bash
# 1. Validate Helm chart
helm lint ./charts/lang-observatory

# 2. Check for hardcoded secrets
grep -r "password\|secret\|key" ./charts/lang-observatory/values.yaml

# 3. Validate template rendering
helm template test ./charts/lang-observatory -f your-values.yaml

# 4. Security scan (if available)
trivy config ./charts/lang-observatory
```

### Post-deployment Verification

```bash
# 1. Verify pods are running as non-root
kubectl get pods -o jsonpath='{.items[*].spec.securityContext.runAsUser}'

# 2. Check for privileged containers
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].securityContext.privileged}'

# 3. Verify network policies are applied
kubectl get networkpolicies

# 4. Check secret management
kubectl get secrets -l app.kubernetes.io/name=lang-observatory
```

## 📋 Security Checklist

### Before Deployment
- [ ] All required secrets generated using secure methods
- [ ] Secrets stored in external secret management system (not in values files)
- [ ] Database TLS/SSL configured
- [ ] Network policies defined
- [ ] Pod security standards enabled
- [ ] Ingress TLS configured

### After Deployment
- [ ] All pods running as non-root
- [ ] No privileged containers detected
- [ ] Network policies enforcing proper segmentation
- [ ] Secrets properly mounted and not visible in pod specs
- [ ] Monitoring and alerting configured for security events

### Ongoing Security
- [ ] Regular security scans of container images
- [ ] Dependency vulnerability monitoring
- [ ] Access reviews and rotation of secrets
- [ ] Security patches applied promptly
- [ ] Audit logs reviewed regularly

## 🚨 Incident Response

### Secret Compromise
If secrets are compromised:

1. **Immediate action**: Rotate all affected secrets
2. **Generate new secrets** using the commands in this guide
3. **Update secret storage** with new values
4. **Redeploy services** with new secrets
5. **Review access logs** for unauthorized usage
6. **Update monitoring** to detect similar incidents

### Security Contact
Report security issues to: security@terragonlabs.com

---

**Last Updated**: 2025-08-01  
**Version**: 1.0  
**Maintained by**: Terragon Autonomous SDLC System