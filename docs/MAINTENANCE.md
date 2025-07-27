# Maintenance Guide

## Overview

This guide covers maintenance procedures and automation for Lang Observatory. Regular maintenance ensures optimal performance, security, and reliability of the observability stack.

## Automated Maintenance

### 1. Dependency Updates

Automated dependency management helps keep the project secure and up-to-date.

#### Usage

```bash
# Standard minor updates
./scripts/dependency-update.sh minor

# Security updates only
./scripts/dependency-update.sh security

# Preview changes (dry run)
DRY_RUN=true ./scripts/dependency-update.sh major

# Auto-create PR for updates
AUTO_MERGE=true ./scripts/dependency-update.sh minor
```

#### Update Types

- **`security`**: Critical security updates only
- **`patch`**: Bug fixes and security patches
- **`minor`**: New features, backward compatible
- **`major`**: Breaking changes, manual review required

#### Automation Schedule

```bash
# Weekly security updates
0 2 * * 1 /path/to/dependency-update.sh security

# Monthly minor updates  
0 3 1 * * /path/to/dependency-update.sh minor

# Quarterly major update check
0 4 1 */3 * DRY_RUN=true /path/to/dependency-update.sh major
```

### 2. Cleanup Operations

Regular cleanup maintains system health and reclaims disk space.

#### Usage

```bash
# Standard cleanup
./scripts/cleanup.sh standard

# Deep cleanup (more aggressive)
./scripts/cleanup.sh deep

# Preview cleanup actions
DRY_RUN=true ./scripts/cleanup.sh all

# Force removal of additional files
FORCE=true ./scripts/cleanup.sh deep
```

#### Cleanup Types

- **`standard`**: Safe cleanup of logs, test artifacts, build files
- **`deep`**: Includes npm cache, Helm dependencies, security reports
- **`docker`**: Docker-specific cleanup only
- **`test`**: Test artifacts and Kubernetes test resources
- **`all`**: Comprehensive cleanup (use with caution)

#### Automation Schedule

```bash
# Daily standard cleanup
0 1 * * * /path/to/cleanup.sh standard

# Weekly deep cleanup
0 2 * * 0 /path/to/cleanup.sh deep

# Monthly comprehensive cleanup
0 3 1 * * FORCE=true /path/to/cleanup.sh all
```

## Manual Maintenance Procedures

### 1. Health Monitoring

#### System Health Check

```bash
# Comprehensive health check
./scripts/health-check.sh

# Component-specific checks
kubectl get pods -n lang-observatory
kubectl get services -n lang-observatory
kubectl get ingress -n lang-observatory
```

#### Performance Monitoring

```bash
# Resource usage
kubectl top pods -n lang-observatory
kubectl top nodes

# Storage usage
kubectl get pvc -n lang-observatory
df -h /var/lib/docker  # Docker storage
```

#### Log Analysis

```bash
# Application logs
kubectl logs -f deployment/lang-observatory-langfuse -n lang-observatory
kubectl logs -f deployment/lang-observatory-openlit -n lang-observatory

# System events
kubectl get events -n lang-observatory --sort-by='.lastTimestamp'
```

### 2. Database Maintenance

#### PostgreSQL Maintenance

```bash
# Connect to database
kubectl exec -it lang-observatory-postgresql-0 -n lang-observatory -- psql -U langfuse

# Database statistics
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables;

# Index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

# Database size
SELECT pg_size_pretty(pg_database_size('langfuse'));
```

#### Backup Procedures

```bash
# Manual backup
kubectl exec lang-observatory-postgresql-0 -n lang-observatory -- \
  pg_dump -U langfuse langfuse | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c backup-20240101.sql.gz | \
  kubectl exec -i lang-observatory-postgresql-0 -n lang-observatory -- \
  psql -U langfuse langfuse
```

#### Vacuum Operations

```bash
# Manual vacuum (during low usage)
kubectl exec -it lang-observatory-postgresql-0 -n lang-observatory -- \
  psql -U langfuse -c "VACUUM ANALYZE;"

# Check for bloat
kubectl exec -it lang-observatory-postgresql-0 -n lang-observatory -- \
  psql -U langfuse -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### 3. Prometheus Maintenance

#### Data Retention Management

```bash
# Check storage usage
kubectl exec prometheus-server-0 -n lang-observatory -- \
  du -sh /prometheus

# Configure retention (in values.yaml)
prometheus:
  server:
    retention: "30d"
    retentionSize: "50GB"
```

#### Query Performance

```bash
# Slow queries analysis
kubectl logs prometheus-server-0 -n lang-observatory | grep "slow_query"

# Top queries by execution time
# Access Prometheus UI and check Status > Runtime & Build Information
```

#### Compaction Status

```bash
# Check compaction status
kubectl exec prometheus-server-0 -n lang-observatory -- \
  promtool query instant 'prometheus_tsdb_compactions_total'
```

### 4. Grafana Maintenance

#### Dashboard Management

```bash
# Export dashboards
kubectl exec grafana-0 -n lang-observatory -- \
  curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
  http://localhost:3000/api/dashboards/uid/$DASHBOARD_UID

# Import dashboards
kubectl exec grafana-0 -n lang-observatory -- \
  curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" \
  -d @dashboard.json \
  http://localhost:3000/api/dashboards/db
```

#### Plugin Management

```bash
# List installed plugins
kubectl exec grafana-0 -n lang-observatory -- grafana-cli plugins ls

# Install plugin
kubectl exec grafana-0 -n lang-observatory -- \
  grafana-cli plugins install $PLUGIN_NAME
```

## Security Maintenance

### 1. Vulnerability Scanning

#### Regular Security Scans

```bash
# Comprehensive security scan
./scripts/security-scan.sh all

# Container vulnerability scan
./scripts/security-scan.sh docker

# Kubernetes security scan
./scripts/security-scan.sh kubernetes
```

#### Automated Security Updates

```bash
# Critical security patches only
./scripts/dependency-update.sh security

# Auto-merge security updates
AUTO_MERGE=true ./scripts/dependency-update.sh security
```

### 2. Access Control Review

#### RBAC Audit

```bash
# Review service accounts
kubectl get serviceaccounts -n lang-observatory

# Check role bindings
kubectl get rolebindings -n lang-observatory
kubectl get clusterrolebindings | grep lang-observatory

# Audit permissions
kubectl auth can-i --list --as=system:serviceaccount:lang-observatory:lang-observatory
```

#### Secret Management

```bash
# List secrets
kubectl get secrets -n lang-observatory

# Rotate secrets (example for database password)
kubectl delete secret langfuse-postgresql -n lang-observatory
kubectl create secret generic langfuse-postgresql \
  --from-literal=postgres-password=new-secure-password \
  -n lang-observatory
```

### 3. Network Security

#### Network Policy Validation

```bash
# Test network connectivity
kubectl run test-pod --image=curlimages/curl -it --rm -- \
  curl lang-observatory-langfuse:3000/health

# Verify network isolation
kubectl exec test-pod -- nc -zv lang-observatory-langfuse 3000
```

## Performance Optimization

### 1. Resource Optimization

#### Resource Usage Analysis

```bash
# CPU and memory usage
kubectl top pods -n lang-observatory --sort-by=cpu
kubectl top pods -n lang-observatory --sort-by=memory

# Resource recommendations
kubectl describe vpa -n lang-observatory  # If VPA is enabled
```

#### Scaling Decisions

```bash
# Horizontal Pod Autoscaler status
kubectl get hpa -n lang-observatory

# Manual scaling
kubectl scale deployment lang-observatory-langfuse --replicas=3 -n lang-observatory
```

### 2. Storage Optimization

#### Volume Usage

```bash
# PVC usage
kubectl get pvc -n lang-observatory
kubectl describe pvc prometheus-server -n lang-observatory

# Storage class performance
kubectl get storageclass
```

#### Data Compression

```bash
# Prometheus data compression
kubectl exec prometheus-server-0 -n lang-observatory -- \
  promtool query instant 'prometheus_tsdb_symbol_table_size_bytes'

# Database table sizes
kubectl exec lang-observatory-postgresql-0 -n lang-observatory -- \
  psql -U langfuse -c "
  SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename)) 
  FROM pg_tables 
  WHERE schemaname = 'public';"
```

## Disaster Recovery

### 1. Backup Strategies

#### Automated Backups

```bash
# Database backup CronJob
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
            - |
              pg_dump \$DATABASE_URL | \
              gzip > /backup/langfuse-\$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: DATABASE_URL
              value: "postgresql://langfuse:password@lang-observatory-postgresql:5432/langfuse"
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

#### Configuration Backups

```bash
# Backup Helm values
kubectl get configmap -n lang-observatory -o yaml > config-backup.yaml

# Backup secrets (base64 encoded)
kubectl get secrets -n lang-observatory -o yaml > secrets-backup.yaml
```

### 2. Recovery Procedures

#### Service Recovery

```bash
# Restart failed pods
kubectl delete pod -l app.kubernetes.io/name=langfuse -n lang-observatory

# Rollback deployment
helm rollback lang-observatory -n lang-observatory

# Force pod recreation
kubectl rollout restart deployment/lang-observatory-langfuse -n lang-observatory
```

#### Data Recovery

```bash
# Restore database from backup
gunzip -c langfuse-20240101-020000.sql.gz | \
  kubectl exec -i lang-observatory-postgresql-0 -n lang-observatory -- \
  psql -U langfuse langfuse

# Restore Prometheus data
kubectl cp prometheus-backup.tar.gz prometheus-server-0:/prometheus/ -n lang-observatory
```

## Monitoring and Alerting

### 1. Health Metrics

#### Key Performance Indicators

- **Service Availability**: >99.9% uptime
- **Response Time**: <500ms for dashboard queries
- **Resource Usage**: <80% CPU/Memory utilization
- **Storage Growth**: <10% monthly increase
- **Error Rate**: <1% of total requests

#### Custom Metrics

```bash
# Add custom Prometheus metrics
cat >> values.yaml << EOF
prometheus:
  server:
    global:
      external_labels:
        environment: production
        cluster: main
EOF
```

### 2. Alert Configuration

#### Critical Alerts

```yaml
# Add to monitoring/alerts.yaml
- alert: ServiceDown
  expr: up{job="lang-observatory"} == 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Lang Observatory service is down"

- alert: HighMemoryUsage
  expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"
```

## Troubleshooting

### Common Issues

#### 1. Pod Crashes

```bash
# Check pod status
kubectl describe pod $POD_NAME -n lang-observatory

# Check logs
kubectl logs $POD_NAME -n lang-observatory --previous

# Resource constraints
kubectl top pod $POD_NAME -n lang-observatory
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
kubectl run debug --image=postgres:15 -it --rm -- \
  psql "postgresql://langfuse:password@lang-observatory-postgresql:5432/langfuse"

# Check database status
kubectl exec lang-observatory-postgresql-0 -n lang-observatory -- \
  pg_isready -U langfuse
```

#### 3. Storage Issues

```bash
# Check PVC status
kubectl describe pvc -n lang-observatory

# Storage usage
kubectl exec $POD_NAME -n lang-observatory -- df -h

# Resize PVC (if supported)
kubectl patch pvc prometheus-server -n lang-observatory \
  -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
```

## Best Practices

### 1. Change Management

- **Test in staging**: Always test changes in a staging environment
- **Gradual rollouts**: Use rolling updates for production changes
- **Rollback plans**: Have rollback procedures ready
- **Documentation**: Document all changes and procedures

### 2. Monitoring

- **Proactive monitoring**: Set up alerts before issues occur
- **Regular reviews**: Review metrics and logs regularly
- **Capacity planning**: Monitor growth trends for capacity planning
- **Performance baselines**: Establish performance baselines

### 3. Security

- **Regular updates**: Keep all components updated
- **Access control**: Use least privilege principles
- **Audit trails**: Maintain audit logs for all changes
- **Vulnerability scanning**: Regular security scans

### 4. Automation

- **Automate routine tasks**: Use scripts for repetitive tasks
- **Infrastructure as Code**: Manage configurations as code
- **CI/CD integration**: Integrate maintenance into CI/CD pipelines
- **Self-healing**: Implement self-healing mechanisms where possible

## Emergency Procedures

### 1. Service Outage

```bash
# Quick health check
./scripts/health-check.sh

# Check all components
kubectl get all -n lang-observatory

# Review recent events
kubectl get events -n lang-observatory --sort-by='.lastTimestamp' | tail -20

# Emergency rollback
helm rollback lang-observatory -n lang-observatory
```

### 2. Data Loss

```bash
# Stop all services
kubectl scale deployment --all --replicas=0 -n lang-observatory

# Restore from backup
./scripts/restore-backup.sh latest

# Verify data integrity
./scripts/data-integrity-check.sh

# Restart services
kubectl scale deployment --all --replicas=1 -n lang-observatory
```

### 3. Security Incident

```bash
# Isolate affected components
kubectl patch networkpolicy default-deny -n lang-observatory \
  -p '{"spec":{"podSelector":{},"policyTypes":["Ingress","Egress"]}}'

# Collect evidence
kubectl get events -n lang-observatory > security-incident-events.log
kubectl logs -l app.kubernetes.io/name=lang-observatory -n lang-observatory > security-incident-logs.log

# Follow incident response plan
# 1. Contain the incident
# 2. Investigate and collect evidence
# 3. Eradicate the threat
# 4. Recover services
# 5. Document lessons learned
```

For additional support or emergency assistance, contact:
- **Technical Support**: opensource@terragonlabs.com
- **Security Issues**: security@terragonlabs.com
- **Emergency Hotline**: [Contact information for 24/7 support]