# Deployment Guide

## Prerequisites

### System Requirements

- **Kubernetes**: v1.24 or higher
- **Helm**: v3.8 or higher
- **Storage**: 20GB+ available for persistent volumes
- **Memory**: 4GB+ available memory
- **CPU**: 2+ CPU cores available

### Access Requirements

- Kubernetes cluster admin access
- Ability to create namespaces and RBAC resources
- Network access to container registries
- DNS resolution for ingress (if using ingress)

## Quick Start Deployment

### 1. Add Helm Repository

```bash
helm repo add terragon-charts https://terragon-labs.github.io/lang-observatory
helm repo update
```

### 2. Create Namespace

```bash
kubectl create namespace lang-observatory
```

### 3. Install with Default Configuration

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --wait
```

### 4. Verify Installation

```bash
# Check pod status
kubectl get pods -n lang-observatory

# Run Helm tests
helm test lang-observatory -n lang-observatory

# Check service status
kubectl get services -n lang-observatory
```

## Configuration

### Basic Configuration

Create a `values.yaml` file for customization:

```yaml
# values.yaml
langfuse:
  enabled: true
  replicaCount: 1
  database:
    host: "langfuse-postgresql"
    name: "langfuse"
    user: "langfuse"
    # password: Set via secret

openlit:
  enabled: true
  replicaCount: 1
  config:
    endpoint: "otel-collector:4317"

prometheus:
  enabled: true
  server:
    persistentVolume:
      enabled: true
      size: 10Gi

grafana:
  enabled: true
  persistence:
    enabled: true
    size: 5Gi
  adminPassword: "your-secure-password"
```

### Install with Custom Configuration

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --values values.yaml \
  --wait
```

## Advanced Configuration

### Production Configuration

```yaml
# production-values.yaml
global:
  environment: production
  
langfuse:
  replicaCount: 3
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"
  database:
    external: true
    host: "production-postgres.example.com"
    ssl: true

openlit:
  replicaCount: 2
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "200m"

prometheus:
  server:
    replicaCount: 2
    retention: "30d"
    persistentVolume:
      size: 100Gi
      storageClass: "fast-ssd"
    resources:
      requests:
        memory: "2Gi"
        cpu: "500m"
      limits:
        memory: "4Gi"
        cpu: "1000m"

grafana:
  replicaCount: 2
  persistence:
    storageClass: "fast-ssd"
    size: 20Gi
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "200m"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: langfuse.example.com
      paths:
        - path: /
          pathType: Prefix
          service: langfuse
    - host: grafana.example.com
      paths:
        - path: /
          pathType: Prefix
          service: grafana
  tls:
    - secretName: lang-observatory-tls
      hosts:
        - langfuse.example.com
        - grafana.example.com

security:
  podSecurityPolicy:
    enabled: true
  networkPolicy:
    enabled: true
  rbac:
    create: true
```

### High Availability Configuration

```yaml
# ha-values.yaml
langfuse:
  replicaCount: 3
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app.kubernetes.io/name
                  operator: In
                  values: ["langfuse"]
            topologyKey: kubernetes.io/hostname

prometheus:
  server:
    replicaCount: 2
    affinity:
      podAntiAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
                - key: app.kubernetes.io/name
                  operator: In
                  values: ["prometheus"]
            topologyKey: kubernetes.io/hostname

postgresql:
  primary:
    persistence:
      enabled: true
      size: 50Gi
  readReplicas:
    replicaCount: 2
```

## Environment-Specific Deployments

### Development Environment

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory-dev \
  --values values/development.yaml \
  --set global.environment=development \
  --set prometheus.server.retention=7d \
  --set grafana.adminPassword=dev-password
```

### Staging Environment

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory-staging \
  --values values/staging.yaml \
  --set global.environment=staging \
  --set ingress.hosts[0].host=staging-langfuse.example.com
```

### Production Environment

```bash
helm install lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --values values/production.yaml \
  --set global.environment=production \
  --timeout 10m \
  --wait
```

## Database Setup

### External PostgreSQL

For production deployments, use an external PostgreSQL instance:

```yaml
langfuse:
  database:
    external: true
    host: "production-postgres.example.com"
    port: 5432
    name: "langfuse"
    user: "langfuse"
    ssl: true
    existingSecret: "langfuse-db-secret"
    secretKey: "password"

postgresql:
  enabled: false
```

Create the database secret:

```bash
kubectl create secret generic langfuse-db-secret \
  --from-literal=password='your-secure-password' \
  --namespace lang-observatory
```

### Database Initialization

```sql
-- Create database and user
CREATE DATABASE langfuse;
CREATE USER langfuse WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;

-- Grant schema permissions
\c langfuse
GRANT ALL ON SCHEMA public TO langfuse;
```

## Storage Configuration

### Persistent Volumes

```yaml
prometheus:
  server:
    persistentVolume:
      enabled: true
      accessModes: ["ReadWriteOnce"]
      size: 50Gi
      storageClass: "gp2"  # AWS EBS
      # storageClass: "standard"  # GKE Standard
      # storageClass: "managed-premium"  # AKS Premium

grafana:
  persistence:
    enabled: true
    size: 10Gi
    storageClass: "gp2"
    accessModes: ["ReadWriteOnce"]
```

### Storage Classes by Cloud Provider

#### AWS EKS
```yaml
storageClass: "gp2"  # General Purpose SSD
# or "gp3" for newer clusters
```

#### Google GKE
```yaml
storageClass: "standard"  # Standard Persistent Disk
# or "ssd" for SSD Persistent Disk
```

#### Azure AKS
```yaml
storageClass: "default"  # Standard HDD
# or "managed-premium" for Premium SSD
```

## Networking Configuration

### Ingress Setup

#### NGINX Ingress Controller

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace
```

#### Configure Lang Observatory Ingress

```yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: langfuse.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: langfuse
    - host: grafana.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: grafana
```

### Load Balancer Configuration

For cloud providers, configure load balancer annotations:

#### AWS
```yaml
service:
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
```

#### Google Cloud
```yaml
service:
  annotations:
    cloud.google.com/neg: '{"ingress": true}'
    cloud.google.com/backend-config: '{"default": "langfuse-backend-config"}'
```

#### Azure
```yaml
service:
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
```

## Security Configuration

### TLS/SSL Setup

#### Using cert-manager

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

Configure ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

### Secret Management

#### Using External Secrets Operator

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system \
  --create-namespace
```

Configure secret store:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: lang-observatory
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "lang-observatory"
```

## Monitoring and Alerting

### Prometheus Configuration

```yaml
prometheus:
  server:
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    retention: 15d
    alertmanager:
      enabled: true
    configMapOverrides:
      prometheus.yml: |
        global:
          scrape_interval: 15s
        scrape_configs:
          - job_name: 'langfuse'
            static_configs:
              - targets: ['langfuse:3000']
```

### Grafana Dashboards

```yaml
grafana:
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards/default
  dashboards:
    default:
      llm-overview:
        url: https://raw.githubusercontent.com/terragon-labs/lang-observatory/main/dashboards/llm-overview.json
```

## Backup and Recovery

### Database Backup

```bash
# Create backup job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: lang-observatory
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: postgres-backup
              image: postgres:15
              command:
                - /bin/bash
                - -c
                - pg_dump \$DATABASE_URL | gzip > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql.gz
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: langfuse-db-secret
                      key: url
              volumeMounts:
                - name: backup-storage
                  mountPath: /backup
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
EOF
```

### Prometheus Data Backup

```bash
# Create Prometheus backup
kubectl exec -n lang-observatory prometheus-server-0 -- \
  tar czf - /prometheus | \
  kubectl exec -i backup-pod -- tar xzf - -C /backup/prometheus
```

## Maintenance

### Updating the Chart

```bash
# Update repository
helm repo update

# Check for updates
helm search repo terragon-charts/lang-observatory

# Upgrade installation
helm upgrade lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --values values.yaml \
  --wait
```

### Rolling Updates

```bash
# Update specific component
helm upgrade lang-observatory terragon-charts/lang-observatory \
  --namespace lang-observatory \
  --set langfuse.image.tag=v2.0.0 \
  --wait
```

### Health Checks

```bash
# Run health check script
./scripts/health-check.sh

# Check component status
kubectl get pods,svc,ingress -n lang-observatory

# View recent events
kubectl get events -n lang-observatory --sort-by='.lastTimestamp'
```

## Troubleshooting

### Common Issues

#### 1. Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n lang-observatory

# Check resource constraints
kubectl top pods -n lang-observatory

# Check events
kubectl get events -n lang-observatory --field-selector involvedObject.name=<pod-name>
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql "postgresql://user:password@host:5432/database"
```

#### 3. Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress -n lang-observatory

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### Getting Support

- **Documentation**: Check the docs/ directory
- **Issues**: Report issues on GitHub
- **Security**: Contact security@terragonlabs.com
- **Community**: Join our Discord server