#!/bin/bash

set -e

# Configuration
NAMESPACE=${NAMESPACE:-lang-observatory}
OUTPUT_DIR=${OUTPUT_DIR:-./metrics-output}
INTERVAL=${INTERVAL:-60}
DURATION=${DURATION:-3600}
PROMETHEUS_URL=${PROMETHEUS_URL:-http://localhost:9090}
GRAFANA_URL=${GRAFANA_URL:-http://localhost:8080}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] ${2:-}$1${NC}"
}

setup_output_directory() {
    mkdir -p "$OUTPUT_DIR"
    log "📁 Created output directory: $OUTPUT_DIR" "$GREEN"
}

collect_kubernetes_metrics() {
    log "📊 Collecting Kubernetes metrics..." "$YELLOW"
    
    local timestamp=$(date +%s)
    local metrics_file="$OUTPUT_DIR/k8s-metrics-$timestamp.json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"namespace\": \"$NAMESPACE\","
        echo "  \"pods\": ["
        
        # Pod metrics
        local first_pod=true
        while IFS= read -r line; do
            if [[ "$first_pod" == "false" ]]; then
                echo ","
            fi
            
            local pod_name=$(echo "$line" | awk '{print $1}')
            local cpu=$(echo "$line" | awk '{print $2}')
            local memory=$(echo "$line" | awk '{print $3}')
            
            echo -n "    {"
            echo -n "\"name\": \"$pod_name\", "
            echo -n "\"cpu\": \"$cpu\", "
            echo -n "\"memory\": \"$memory\""
            echo -n "    }"
            
            first_pod=false
        done < <(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null || echo "")
        
        echo ""
        echo "  ],"
        echo "  \"nodes\": ["
        
        # Node metrics
        local first_node=true
        while IFS= read -r line; do
            if [[ "$first_node" == "false" ]]; then
                echo ","
            fi
            
            local node_name=$(echo "$line" | awk '{print $1}')
            local cpu=$(echo "$line" | awk '{print $2}')
            local cpu_percent=$(echo "$line" | awk '{print $3}')
            local memory=$(echo "$line" | awk '{print $4}')
            local memory_percent=$(echo "$line" | awk '{print $5}')
            
            echo -n "    {"
            echo -n "\"name\": \"$node_name\", "
            echo -n "\"cpu\": \"$cpu\", "
            echo -n "\"cpu_percent\": \"$cpu_percent\", "
            echo -n "\"memory\": \"$memory\", "
            echo -n "\"memory_percent\": \"$memory_percent\""
            echo -n "    }"
            
            first_node=false
        done < <(kubectl top nodes --no-headers 2>/dev/null || echo "")
        
        echo ""
        echo "  ]"
        echo "}"
    } > "$metrics_file"
    
    log "✅ Kubernetes metrics saved to: $metrics_file" "$GREEN"
}

collect_prometheus_metrics() {
    log "📈 Collecting Prometheus metrics..." "$YELLOW"
    
    if ! curl -sf "$PROMETHEUS_URL/api/v1/label/__name__/values" > /dev/null; then
        log "❌ Cannot connect to Prometheus at $PROMETHEUS_URL" "$RED"
        return 1
    fi
    
    local timestamp=$(date +%s)
    local metrics_file="$OUTPUT_DIR/prometheus-metrics-$timestamp.json"
    
    # Define key metrics to collect
    local metrics=(
        "up"
        "prometheus_tsdb_head_samples_appended_total"
        "prometheus_tsdb_head_series"
        "process_cpu_seconds_total"
        "process_resident_memory_bytes"
        "http_requests_total"
        "langfuse_traces_total"
        "langfuse_tokens_total"
        "openlit_llm_requests_total"
        "openlit_llm_tokens_total"
    )
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"prometheus_url\": \"$PROMETHEUS_URL\","
        echo "  \"metrics\": {"
        
        local first_metric=true
        for metric in "${metrics[@]}"; do
            if [[ "$first_metric" == "false" ]]; then
                echo ","
            fi
            
            echo -n "    \"$metric\": "
            curl -sf "$PROMETHEUS_URL/api/v1/query?query=$metric" | jq '.data.result' || echo "null"
            
            first_metric=false
        done
        
        echo ""
        echo "  }"
        echo "}"
    } > "$metrics_file"
    
    log "✅ Prometheus metrics saved to: $metrics_file" "$GREEN"
}

collect_application_metrics() {
    log "🔍 Collecting application-specific metrics..." "$YELLOW"
    
    local timestamp=$(date +%s)
    local metrics_file="$OUTPUT_DIR/app-metrics-$timestamp.json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"namespace\": \"$NAMESPACE\","
        
        # Langfuse metrics
        echo "  \"langfuse\": {"
        local langfuse_pod=$(kubectl get pods -l app.kubernetes.io/name=langfuse -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$langfuse_pod" ]]; then
            echo "    \"status\": \"running\","
            echo "    \"logs_sample\": ["
            kubectl logs "$langfuse_pod" -n "$NAMESPACE" --tail=5 2>/dev/null | while IFS= read -r line; do
                echo "      \"$(echo "$line" | sed 's/"/\\"/g')\","
            done | sed '$ s/,$//'
            echo "    ]"
        else
            echo "    \"status\": \"not_found\""
        fi
        echo "  },"
        
        # Prometheus metrics
        echo "  \"prometheus\": {"
        local prometheus_pod=$(kubectl get pods -l app.kubernetes.io/name=prometheus -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$prometheus_pod" ]]; then
            echo "    \"status\": \"running\","
            echo "    \"targets\": \"$(kubectl exec -n "$NAMESPACE" "$prometheus_pod" -- wget -qO- http://localhost:9090/api/v1/targets 2>/dev/null | jq '.data.activeTargets | length' || echo "0")\""
        else
            echo "    \"status\": \"not_found\","
            echo "    \"targets\": 0"
        fi
        echo "  },"
        
        # Grafana metrics
        echo "  \"grafana\": {"
        local grafana_pod=$(kubectl get pods -l app.kubernetes.io/name=grafana -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$grafana_pod" ]]; then
            echo "    \"status\": \"running\","
            echo "    \"datasources\": \"$(kubectl exec -n "$NAMESPACE" "$grafana_pod" -- wget -qO- --header='Authorization: Bearer admin' http://localhost:3000/api/datasources 2>/dev/null | jq '. | length' || echo "0")\""
        else
            echo "    \"status\": \"not_found\","
            echo "    \"datasources\": 0"
        fi
        echo "  }"
        
        echo "}"
    } > "$metrics_file"
    
    log "✅ Application metrics saved to: $metrics_file" "$GREEN"
}

collect_performance_metrics() {
    log "⚡ Collecting performance metrics..." "$YELLOW"
    
    local timestamp=$(date +%s)
    local metrics_file="$OUTPUT_DIR/performance-metrics-$timestamp.json"
    
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
        echo "  \"namespace\": \"$NAMESPACE\","
        
        # API response times
        echo "  \"api_performance\": {"
        local langfuse_service="langfuse.$NAMESPACE.svc.cluster.local"
        local response_time=$(kubectl run perf-test --rm -i --restart=Never --image=curlimages/curl -- \
            sh -c "time curl -sf http://$langfuse_service:3000/api/public/health" 2>&1 | \
            grep "real" | awk '{print $2}' || echo "timeout")
        echo "    \"langfuse_health_check\": \"$response_time\","
        
        # Database connection test
        local postgres_pod=$(kubectl get pods -l app.kubernetes.io/name=postgresql -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [[ -n "$postgres_pod" ]]; then
            local db_connections=$(kubectl exec -n "$NAMESPACE" "$postgres_pod" -- \
                psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | grep -E "^\s*[0-9]+\s*$" | tr -d ' ' || echo "0")
            echo "    \"database_connections\": $db_connections,"
        else
            echo "    \"database_connections\": 0,"
        fi
        
        # Memory usage patterns
        echo "    \"memory_usage\": ["
        kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null | while IFS= read -r line; do
            local pod_name=$(echo "$line" | awk '{print $1}')
            local memory=$(echo "$line" | awk '{print $3}')
            echo "      {\"pod\": \"$pod_name\", \"memory\": \"$memory\"},"
        done | sed '$ s/,$//'
        echo "    ]"
        
        echo "  }"
        echo "}"
    } > "$metrics_file"
    
    log "✅ Performance metrics saved to: $metrics_file" "$GREEN"
}

generate_summary_report() {
    log "📋 Generating summary report..." "$YELLOW"
    
    local timestamp=$(date +%s)
    local report_file="$OUTPUT_DIR/metrics-summary-$timestamp.md"
    
    {
        echo "# Lang Observatory Metrics Summary"
        echo ""
        echo "**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "**Namespace:** $NAMESPACE"
        echo "**Collection Duration:** ${DURATION}s (${INTERVAL}s intervals)"
        echo ""
        
        echo "## System Health"
        echo ""
        
        # Check if all components are running
        local total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
        local running_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        
        echo "- **Total Pods:** $total_pods"
        echo "- **Running Pods:** $running_pods"
        echo "- **Health Status:** $(if [[ $running_pods -eq $total_pods ]]; then echo "✅ Healthy"; else echo "⚠️ Issues Detected"; fi)"
        echo ""
        
        echo "## Resource Usage"
        echo ""
        echo "### Pod Resource Consumption"
        echo ""
        echo "| Pod Name | CPU | Memory |"
        echo "|----------|-----|--------|"
        
        kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null | while IFS= read -r line; do
            local pod_name=$(echo "$line" | awk '{print $1}')
            local cpu=$(echo "$line" | awk '{print $2}')
            local memory=$(echo "$line" | awk '{print $3}')
            echo "| $pod_name | $cpu | $memory |"
        done
        
        echo ""
        echo "## Component Status"
        echo ""
        
        # Check each component
        local components=("langfuse" "prometheus" "grafana" "postgresql")
        for component in "${components[@]}"; do
            local pod_count=$(kubectl get pods -l "app.kubernetes.io/name=$component" -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
            local running_count=$(kubectl get pods -l "app.kubernetes.io/name=$component" -n "$NAMESPACE" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
            
            echo "### $component"
            echo "- **Desired Replicas:** $pod_count"
            echo "- **Running Replicas:** $running_count"
            echo "- **Status:** $(if [[ $running_count -eq $pod_count && $pod_count -gt 0 ]]; then echo "✅ Healthy"; else echo "❌ Unhealthy"; fi)"
            echo ""
        done
        
        echo "## Files Generated"
        echo ""
        find "$OUTPUT_DIR" -name "*-$timestamp.*" -type f | while read -r file; do
            echo "- $(basename "$file")"
        done
        
        echo ""
        echo "---"
        echo "*Generated by Lang Observatory metrics collector*"
        
    } > "$report_file"
    
    log "✅ Summary report saved to: $report_file" "$GREEN"
}

monitor_continuously() {
    log "🔄 Starting continuous monitoring (Duration: ${DURATION}s, Interval: ${INTERVAL}s)..." "$YELLOW"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        log "📊 Collecting metrics batch..." "$YELLOW"
        
        collect_kubernetes_metrics
        collect_prometheus_metrics
        collect_application_metrics
        collect_performance_metrics
        
        local remaining_time=$((end_time - $(date +%s)))
        if [[ $remaining_time -gt 0 ]]; then
            log "⏳ Waiting ${INTERVAL}s before next collection (${remaining_time}s remaining)..." "$YELLOW"
            sleep "$INTERVAL"
        fi
    done
    
    generate_summary_report
    log "✅ Continuous monitoring completed!" "$GREEN"
}

cleanup_old_metrics() {
    log "🧹 Cleaning up old metrics files..." "$YELLOW"
    
    # Remove files older than 7 days
    find "$OUTPUT_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
    find "$OUTPUT_DIR" -name "*.md" -mtime +7 -delete 2>/dev/null || true
    
    log "✅ Cleanup completed" "$GREEN"
}

show_help() {
    cat << EOF
Lang Observatory Metrics Collector

Usage: $0 [OPTIONS] [COMMAND]

Commands:
  collect     Collect metrics once (default)
  monitor     Monitor continuously
  cleanup     Clean up old metrics files

Options:
  -n, --namespace     Kubernetes namespace (default: lang-observatory)
  -o, --output-dir    Output directory (default: ./metrics-output)
  -i, --interval      Collection interval in seconds (default: 60)
  -d, --duration      Monitoring duration in seconds (default: 3600)
  -p, --prometheus    Prometheus URL (default: http://localhost:9090)
  -g, --grafana       Grafana URL (default: http://localhost:8080)
  -h, --help          Show this help message

Examples:
  $0 collect                          # Collect metrics once
  $0 monitor -i 30 -d 1800           # Monitor for 30 minutes with 30s intervals
  $0 cleanup                          # Clean up old files
EOF
}

main() {
    local command="collect"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            collect|monitor|cleanup)
                command="$1"
                shift
                ;;
            --namespace|-n)
                NAMESPACE="$2"
                shift 2
                ;;
            --output-dir|-o)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --interval|-i)
                INTERVAL="$2"
                shift 2
                ;;
            --duration|-d)
                DURATION="$2"
                shift 2
                ;;
            --prometheus|-p)
                PROMETHEUS_URL="$2"
                shift 2
                ;;
            --grafana|-g)
                GRAFANA_URL="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log "❌ Unknown option: $1" "$RED"
                show_help
                exit 1
                ;;
        esac
    done
    
    setup_output_directory
    
    case "$command" in
        "collect")
            log "📊 Collecting metrics once..." "$GREEN"
            collect_kubernetes_metrics
            collect_prometheus_metrics
            collect_application_metrics
            collect_performance_metrics
            generate_summary_report
            ;;
        "monitor")
            monitor_continuously
            ;;
        "cleanup")
            cleanup_old_metrics
            ;;
        *)
            log "❌ Unknown command: $command" "$RED"
            show_help
            exit 1
            ;;
    esac
    
    log "🎉 Metrics collection completed!" "$GREEN"
}

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    log "❌ kubectl is not installed or not in PATH" "$RED"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log "❌ jq is not installed or not in PATH" "$RED"
    exit 1
fi

# Run main function
main "$@"