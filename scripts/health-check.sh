#!/bin/bash

set -e

NAMESPACE=${NAMESPACE:-lang-observatory}
TIMEOUT=${TIMEOUT:-300}

echo "🔍 Starting health check for Lang Observatory components..."

check_component() {
    local component=$1
    local selector=$2
    local port=$3
    local path=${4:-/health}
    
    echo "Checking $component..."
    
    kubectl wait --for=condition=ready pod -l "$selector" -n "$NAMESPACE" --timeout="${TIMEOUT}s"
    
    if [ ! -z "$port" ]; then
        POD_NAME=$(kubectl get pods -l "$selector" -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
        kubectl port-forward -n "$NAMESPACE" "$POD_NAME" "$port:$port" &
        PF_PID=$!
        
        sleep 5
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}" || echo "000")
        
        kill $PF_PID 2>/dev/null || true
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ $component is healthy (HTTP $HTTP_CODE)"
        else
            echo "❌ $component health check failed (HTTP $HTTP_CODE)"
            return 1
        fi
    else
        echo "✅ $component pods are ready"
    fi
}

check_component "Langfuse" "app.kubernetes.io/name=langfuse" "3000" "/api/public/health"
check_component "OpenLIT" "app.kubernetes.io/name=openlit" "4317"
check_component "Prometheus" "app.kubernetes.io/name=prometheus" "9090" "/-/healthy"
check_component "Grafana" "app.kubernetes.io/name=grafana" "3000" "/api/health"

echo "🎉 All components are healthy!"

exit 0