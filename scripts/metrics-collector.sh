#!/bin/bash

set -e

NAMESPACE=${NAMESPACE:-lang-observatory}
OUTPUT_DIR=${OUTPUT_DIR:-./metrics}
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")

echo "📊 Collecting metrics from Lang Observatory components..."

mkdir -p "$OUTPUT_DIR"

collect_prometheus_metrics() {
    echo "Collecting Prometheus metrics..."
    
    kubectl port-forward -n "$NAMESPACE" svc/prometheus 9090:9090 &
    PF_PID=$!
    
    sleep 5
    
    curl -s "http://localhost:9090/api/v1/query?query=up" > "$OUTPUT_DIR/prometheus-up-$TIMESTAMP.json"
    curl -s "http://localhost:9090/metrics" > "$OUTPUT_DIR/prometheus-metrics-$TIMESTAMP.txt"
    
    kill $PF_PID 2>/dev/null || true
    
    echo "✅ Prometheus metrics collected"
}

collect_grafana_metrics() {
    echo "Collecting Grafana metrics..."
    
    kubectl port-forward -n "$NAMESPACE" svc/grafana 3001:3000 &
    PF_PID=$!
    
    sleep 5
    
    curl -s "http://localhost:3001/metrics" > "$OUTPUT_DIR/grafana-metrics-$TIMESTAMP.txt"
    
    kill $PF_PID 2>/dev/null || true
    
    echo "✅ Grafana metrics collected"
}

collect_kubernetes_metrics() {
    echo "Collecting Kubernetes metrics..."
    
    kubectl top pods -n "$NAMESPACE" > "$OUTPUT_DIR/pod-resources-$TIMESTAMP.txt" 2>/dev/null || echo "Metrics server not available" > "$OUTPUT_DIR/pod-resources-$TIMESTAMP.txt"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' > "$OUTPUT_DIR/events-$TIMESTAMP.txt"
    kubectl get pods -n "$NAMESPACE" -o json > "$OUTPUT_DIR/pods-status-$TIMESTAMP.json"
    
    echo "✅ Kubernetes metrics collected"
}

generate_summary() {
    echo "Generating metrics summary..."
    
    cat > "$OUTPUT_DIR/summary-$TIMESTAMP.md" << EOF
# Lang Observatory Metrics Summary

**Generated:** $(date)
**Namespace:** $NAMESPACE

## Component Status

\`\`\`
$(kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "Namespace not found")
\`\`\`

## Service Endpoints

\`\`\`
$(kubectl get svc -n "$NAMESPACE" 2>/dev/null || echo "No services found")
\`\`\`

## Recent Events

\`\`\`
$(kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | tail -10 2>/dev/null || echo "No events found")
\`\`\`
EOF

    echo "✅ Summary generated"
}

collect_prometheus_metrics
collect_grafana_metrics
collect_kubernetes_metrics
generate_summary

echo "🎉 Metrics collection complete! Files saved to $OUTPUT_DIR"

exit 0