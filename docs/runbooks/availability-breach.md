# Availability Breach Runbook

## Overview

This runbook provides step-by-step instructions for responding to Lang
Observatory availability breaches when system availability drops below 99.9% SLO
threshold.

## Severity Classification

- **Critical**: Availability < 99.9% for > 5 minutes
- **Warning**: Availability < 99.95% for > 2 minutes
- **Info**: Availability trends declining

## Immediate Response (0-5 minutes)

### 1. Acknowledge Alert

```bash
# Silence alert to prevent spam
curl -X POST http://alertmanager:9093/api/v1/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [{"name": "alertname", "value": "LangObservatoryAvailabilityBreach"}],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "endsAt": "'$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S.000Z)'",
    "comment": "Investigating availability breach - Incident Commander: YOUR_NAME"
  }'
```

### 2. Quick Health Check

```bash
# Check all core services
kubectl get pods -n lang-observatory -l app.kubernetes.io/instance=lang-observatory

# Check service endpoints
kubectl get svc -n lang-observatory
kubectl get ingress -n lang-observatory

# Quick connectivity test
curl -f http://langfuse-service:3000/api/health || echo "Langfuse DOWN"
curl -f http://openlit-service:3001/health || echo "OpenLIT DOWN"
curl -f http://grafana-service:8080/api/health || echo "Grafana DOWN"
curl -f http://prometheus-service:9090/-/healthy || echo "Prometheus DOWN"
```

### 3. Identify Failing Component

```bash
# Check service availability metrics
kubectl exec -n lang-observatory deployment/prometheus -- \
  promtool query instant 'up{job=~"langfuse|openlit|grafana"}'

# Check recent error rates
kubectl exec -n lang-observatory deployment/prometheus -- \
  promtool query instant 'rate(http_requests_total{code!~"2.."}[5m])'
```

## Investigation Phase (5-15 minutes)

### 4. Resource Analysis

```bash
# Check resource utilization
kubectl top pods -n lang-observatory
kubectl top nodes

# Check for resource exhaustion
kubectl describe pods -n lang-observatory | grep -E "(Warning|Error|Failed)"

# Memory and CPU limits
kubectl get pods -n lang-observatory -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].resources}{"\n"}{end}'
```

### 5. Recent Changes Assessment

```bash
# Check recent deployments
kubectl rollout history deployment -n lang-observatory
kubectl get events -n lang-observatory --sort-by='.lastTimestamp' | tail -20

# Check Helm release history
helm history lang-observatory -n lang-observatory
```

### 6. Database and Storage Health

```bash
# Check persistent volumes
kubectl get pv,pvc -n lang-observatory

# Database connectivity (if using external DB)
kubectl exec -n lang-observatory deployment/langfuse -- \
  pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER

# Storage space
kubectl exec -n lang-observatory deployment/prometheus -- df -h
```

## Diagnosis Deep Dive (15-30 minutes)

### 7. Log Analysis

```bash
# Recent error logs from all services
kubectl logs -n lang-observatory -l app.kubernetes.io/instance=lang-observatory --since=10m | grep -i error

# Specific service logs
kubectl logs -n lang-observatory deployment/langfuse --tail=100
kubectl logs -n lang-observatory deployment/openlit --tail=100
kubectl logs -n lang-observatory deployment/grafana --tail=100
kubectl logs -n lang-observatory deployment/prometheus --tail=100
```

### 8. Network Connectivity

```bash
# DNS resolution
kubectl exec -n lang-observatory deployment/langfuse -- nslookup prometheus-service

# Service-to-service connectivity
kubectl exec -n lang-observatory deployment/langfuse -- \
  wget -qO- --timeout=5 http://prometheus-service:9090/-/healthy

# External dependencies
kubectl exec -n lang-observatory deployment/langfuse -- \
  wget -qO- --timeout=5 https://api.openai.com/v1/models || echo "External API unreachable"
```

### 9. Performance Metrics Analysis

```bash
# Query Prometheus for detailed metrics
kubectl port-forward -n lang-observatory svc/prometheus-service 9090:9090 &
PF_PID=$!

# Response time trends
curl -s "http://localhost:9090/api/v1/query_range?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60"

# Error rate trends
curl -s "http://localhost:9090/api/v1/query_range?query=rate(http_requests_total{code!~\"2..\"}[5m])&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60"

kill $PF_PID
```

## Mitigation Strategies

### 10. Quick Fixes

#### Restart Unhealthy Pods

```bash
# Restart specific deployment
kubectl rollout restart deployment/langfuse -n lang-observatory
kubectl rollout restart deployment/openlit -n lang-observatory

# Wait for rollout completion
kubectl rollout status deployment/langfuse -n lang-observatory --timeout=300s
```

#### Scale Up Resources

```bash
# Increase replica count
kubectl scale deployment/langfuse --replicas=3 -n lang-observatory
kubectl scale deployment/openlit --replicas=2 -n lang-observatory

# Increase resource limits (temporary)
kubectl patch deployment langfuse -n lang-observatory -p='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "langfuse",
          "resources": {
            "limits": {"memory": "2Gi", "cpu": "1000m"},
            "requests": {"memory": "1Gi", "cpu": "500m"}
          }
        }]
      }
    }
  }
}'
```

#### Traffic Rerouting

```bash
# Check ingress configuration
kubectl get ingress -n lang-observatory -o yaml

# Temporarily route traffic to healthy instances only
kubectl annotate ingress langfuse-ingress -n lang-observatory \
  nginx.ingress.kubernetes.io/upstream-hash-by='$request_uri'
```

### 11. Database Recovery

```bash
# If database is the issue
kubectl exec -n lang-observatory deployment/langfuse -- \
  psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';"

# Restart database connection pool
kubectl rollout restart deployment/langfuse -n lang-observatory
```

### 12. Rollback Strategy

```bash
# If recent deployment caused issue
helm rollback lang-observatory 1 -n lang-observatory

# Monitor rollback progress
kubectl rollout status deployment -n lang-observatory --timeout=600s
```

## Recovery Verification (30-45 minutes)

### 13. Health Validation

```bash
# Comprehensive health check
for service in langfuse openlit grafana prometheus; do
  echo "Testing $service..."
  kubectl exec -n lang-observatory deployment/$service -- \
    wget -qO- --timeout=10 http://localhost:$(kubectl get svc ${service}-service -n lang-observatory -o jsonpath='{.spec.ports[0].targetPort}')/health 2>/dev/null && echo "✓ $service healthy" || echo "✗ $service unhealthy"
done
```

### 14. Load Testing

```bash
# Run quick load test to verify stability
k6 run --duration=2m --vus=10 tests/performance/load-test.js

# Monitor key metrics during test
kubectl exec -n lang-observatory deployment/prometheus -- \
  promtool query instant 'rate(http_requests_total[1m])'
```

### 15. Error Budget Impact

```bash
# Calculate error budget consumption
kubectl exec -n lang-observatory deployment/prometheus -- \
  promtool query instant '(1 - (sum(rate(http_requests_total{code=~"2.."}[30d])) / sum(rate(http_requests_total[30d])))) * 100'

# Document downtime for postmortem
echo "Availability breach: $(date -u)" >> /tmp/incident-log.txt
echo "Duration: $(( $(date +%s) - START_TIME )) seconds" >> /tmp/incident-log.txt
```

## Communication

### 16. Status Updates

```bash
# Update incident status
curl -X POST $SLACK_WEBHOOK -H 'Content-Type: application/json' -d '{
  "text": "🔄 Lang Observatory availability incident update",
  "attachments": [{
    "color": "warning",
    "fields": [
      {"title": "Status", "value": "Investigating", "short": true},
      {"title": "Duration", "value": "'$(( $(date +%s) - START_TIME ))'s", "short": true},
      {"title": "Impact", "value": "Service degradation", "short": true},
      {"title": "Next Update", "value": "15 minutes", "short": true}
    ]
  }]
}'
```

### 17. Resolution Communication

```bash
# Resolution notification
curl -X POST $SLACK_WEBHOOK -H 'Content-Type: application/json' -d '{
  "text": "✅ Lang Observatory availability incident resolved",
  "attachments": [{
    "color": "good",
    "fields": [
      {"title": "Resolution Time", "value": "'$(( $(date +%s) - START_TIME ))'s", "short": true},
      {"title": "Root Cause", "value": "DATABASE_CONNECTION_POOL_EXHAUSTION", "short": true},
      {"title": "Action Items", "value": "1. Postmortem scheduled\n2. Monitoring improved\n3. Runbook updated", "short": false}
    ]
  }]
}'
```

## Post-Incident Activities

### 18. Data Collection

```bash
# Export relevant metrics for analysis
kubectl exec -n lang-observatory deployment/prometheus -- \
  curl -s "http://localhost:9090/api/v1/export?match[]={__name__=~\"http_requests_.*\"}&start=$(date -d '2 hours ago' +%s)&end=$(date +%s)" > incident-metrics.json

# Collect logs from incident timeframe
kubectl logs -n lang-observatory --all-containers --since=2h > incident-logs.txt
```

### 19. Immediate Improvements

```bash
# Add additional monitoring
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: enhanced-availability-monitoring
  namespace: lang-observatory
spec:
  groups:
  - name: availability.enhanced
    rules:
    - alert: ComponentUnavailable
      expr: up{job=~"langfuse|openlit|grafana"} == 0
      for: 30s
      labels:
        severity: critical
      annotations:
        summary: "{{ \$labels.job }} component is unavailable"
EOF
```

## Prevention Measures

### 20. Capacity Planning

```bash
# Document resource usage patterns
kubectl exec -n lang-observatory deployment/prometheus -- \
  promtool query instant 'avg_over_time(container_memory_usage_bytes[24h]) / 1024 / 1024'

# Set up proactive scaling alerts
kubectl apply -f monitoring/proactive-scaling-alerts.yaml
```

## Escalation Contacts

- **Primary On-Call**: Lang Observatory Team
- **Secondary**: Platform Engineering Team
- **Management**: Director of Engineering
- **External Vendor**: Cloud Provider Support

## Related Documentation

- [SLO/SLI Definitions](../SLO_SLI_DEFINITIONS.md)
- [Architecture Overview](../ARCHITECTURE.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Monitoring Setup](../MAINTENANCE.md)

## Runbook Maintenance

Last Updated: {{ date }} Next Review: {{ date + 3 months }} Owner: Lang
Observatory SRE Team
