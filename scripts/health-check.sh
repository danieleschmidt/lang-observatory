#!/bin/bash

set -e

# Configuration
NAMESPACE=${NAMESPACE:-lang-observatory}
TIMEOUT=${TIMEOUT:-300}
OUTPUT_FORMAT=${OUTPUT_FORMAT:-text}
VERBOSE=${VERBOSE:-false}
METRICS_OUTPUT=${METRICS_OUTPUT:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Health check results
declare -A HEALTH_RESULTS
OVERALL_HEALTH=true

log() {
    if [[ "$VERBOSE" == "true" ]] || [[ "$1" == "ERROR" ]] || [[ "$1" == "INFO" ]]; then
        echo -e "${2:-}[$(date +'%Y-%m-%d %H:%M:%S')] $1: ${3}${NC}"
    fi
}

check_prerequisites() {
    log "INFO" "${YELLOW}" "🔍 Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "${RED}" "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "${RED}" "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "ERROR" "${RED}" "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log "INFO" "${GREEN}" "✅ Prerequisites check passed"
}

check_component() {
    local component=$1
    local selector=$2
    local port=$3
    local path=${4:-/health}
    local expected_code=${5:-200}
    
    log "INFO" "${YELLOW}" "🔍 Checking $component..."
    
    # Check if pods exist
    local pod_count
    pod_count=$(kubectl get pods -l "$selector" -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    if [[ $pod_count -eq 0 ]]; then
        log "ERROR" "${RED}" "❌ No pods found for $component with selector: $selector"
        HEALTH_RESULTS["$component"]="NO_PODS"
        OVERALL_HEALTH=false
        return 1
    fi
    
    # Wait for pods to be ready
    log "INFO" "" "Waiting for $component pods to be ready..."
    if ! kubectl wait --for=condition=ready pod -l "$selector" -n "$NAMESPACE" --timeout="${TIMEOUT}s" &>/dev/null; then
        log "ERROR" "${RED}" "❌ $component pods failed to become ready within ${TIMEOUT}s"
        HEALTH_RESULTS["$component"]="NOT_READY"
        OVERALL_HEALTH=false
        return 1
    fi
    
    # Check HTTP endpoint if port is specified
    if [[ -n "$port" ]]; then
        local pod_name
        pod_name=$(kubectl get pods -l "$selector" -n "$NAMESPACE" -o jsonpath='{.items[0].metadata.name}')
        
        log "INFO" "" "Testing HTTP endpoint for $component..."
        
        # Use kubectl exec instead of port-forward for better reliability
        local http_code
        http_code=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- \
            wget --spider --server-response "http://localhost:${port}${path}" 2>&1 | \
            grep "HTTP/" | tail -1 | awk '{print $2}' || echo "000")
        
        if [[ "$http_code" == "$expected_code" ]]; then
            log "INFO" "${GREEN}" "✅ $component is healthy (HTTP $http_code)"
            HEALTH_RESULTS["$component"]="HEALTHY"
        else
            log "ERROR" "${RED}" "❌ $component health check failed (HTTP $http_code, expected $expected_code)"
            HEALTH_RESULTS["$component"]="UNHEALTHY"
            OVERALL_HEALTH=false
            return 1
        fi
    else
        log "INFO" "${GREEN}" "✅ $component pods are ready"
        HEALTH_RESULTS["$component"]="READY"
    fi
    
    # Collect metrics if enabled
    if [[ "$METRICS_OUTPUT" == "true" ]]; then
        collect_component_metrics "$component" "$selector"
    fi
}

collect_component_metrics() {
    local component=$1
    local selector=$2
    
    log "INFO" "" "📊 Collecting metrics for $component..."
    
    # Get resource usage
    kubectl top pods -l "$selector" -n "$NAMESPACE" --no-headers 2>/dev/null | while read -r line; do
        local pod_name cpu memory
        pod_name=$(echo "$line" | awk '{print $1}')
        cpu=$(echo "$line" | awk '{print $2}')
        memory=$(echo "$line" | awk '{print $3}')
        
        echo "METRIC component=$component pod=$pod_name cpu=$cpu memory=$memory"
    done
}

check_network_connectivity() {
    log "INFO" "${YELLOW}" "🌐 Checking network connectivity..."
    
    # Check if services are accessible within the cluster
    local services
    services=$(kubectl get services -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for service in $services; do
        if kubectl run connectivity-test --rm -i --restart=Never --image=busybox -- \
           nslookup "$service.$NAMESPACE.svc.cluster.local" &>/dev/null; then
            log "INFO" "${GREEN}" "✅ Service $service is resolvable"
        else
            log "ERROR" "${RED}" "❌ Service $service is not resolvable"
            OVERALL_HEALTH=false
        fi
    done
}

check_storage() {
    log "INFO" "${YELLOW}" "💾 Checking persistent volumes..."
    
    # Check PVC status
    while IFS= read -r pvc; do
        local pvc_name status
        pvc_name=$(echo "$pvc" | awk '{print $1}')
        status=$(echo "$pvc" | awk '{print $2}')
        
        if [[ "$status" == "Bound" ]]; then
            log "INFO" "${GREEN}" "✅ PVC $pvc_name is bound"
        else
            log "ERROR" "${RED}" "❌ PVC $pvc_name is in status: $status"
            OVERALL_HEALTH=false
        fi
    done < <(kubectl get pvc -n "$NAMESPACE" --no-headers 2>/dev/null)
}

output_results() {
    case "$OUTPUT_FORMAT" in
        "json")
            output_json
            ;;
        "prometheus")
            output_prometheus
            ;;
        *)
            output_text
            ;;
    esac
}

output_text() {
    echo ""
    echo "==========================================="
    echo "       HEALTH CHECK SUMMARY"
    echo "==========================================="
    echo "Namespace: $NAMESPACE"
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""
    
    for component in "${!HEALTH_RESULTS[@]}"; do
        local status="${HEALTH_RESULTS[$component]}"
        case "$status" in
            "HEALTHY"|"READY")
                echo -e "✅ $component: ${GREEN}$status${NC}"
                ;;
            *)
                echo -e "❌ $component: ${RED}$status${NC}"
                ;;
        esac
    done
    
    echo ""
    if [[ "$OVERALL_HEALTH" == "true" ]]; then
        echo -e "🎉 ${GREEN}Overall Status: HEALTHY${NC}"
    else
        echo -e "⚠️  ${RED}Overall Status: UNHEALTHY${NC}"
    fi
    echo "==========================================="
}

output_json() {
    local json_output='{'
    json_output+='"timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",'
    json_output+='"namespace":"'$NAMESPACE'",'
    json_output+='"overall_health":'$(if [[ "$OVERALL_HEALTH" == "true" ]]; then echo "true"; else echo "false"; fi)','
    json_output+='"components":{'
    
    local first=true
    for component in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$first" == "false" ]]; then
            json_output+=','
        fi
        json_output+='"'$component'":"'${HEALTH_RESULTS[$component]}'"'
        first=false
    done
    
    json_output+='}}'
    echo "$json_output"
}

output_prometheus() {
    echo "# HELP lang_observatory_component_health Health status of Lang Observatory components"
    echo "# TYPE lang_observatory_component_health gauge"
    
    for component in "${!HEALTH_RESULTS[@]}"; do
        local value
        case "${HEALTH_RESULTS[$component]}" in
            "HEALTHY"|"READY")
                value=1
                ;;
            *)
                value=0
                ;;
        esac
        echo "lang_observatory_component_health{component=\"$component\",namespace=\"$NAMESPACE\"} $value"
    done
    
    echo "# HELP lang_observatory_overall_health Overall health status"
    echo "# TYPE lang_observatory_overall_health gauge"
    local overall_value
    if [[ "$OVERALL_HEALTH" == "true" ]]; then
        overall_value=1
    else
        overall_value=0
    fi
    echo "lang_observatory_overall_health{namespace=\"$NAMESPACE\"} $overall_value"
}

main() {
    log "INFO" "${YELLOW}" "🚀 Starting comprehensive health check for Lang Observatory..."
    
    check_prerequisites
    
    # Check core components
    check_component "Langfuse" "app.kubernetes.io/name=langfuse" "3000" "/api/public/health"
    check_component "OpenLIT" "app.kubernetes.io/name=openlit" "4317" "/health"
    check_component "Prometheus" "app.kubernetes.io/name=prometheus" "9090" "/-/healthy"
    check_component "Grafana" "app.kubernetes.io/name=grafana" "3000" "/api/health"
    check_component "PostgreSQL" "app.kubernetes.io/name=postgresql" "" "" # Just check pod readiness
    
    # Additional checks
    check_network_connectivity
    check_storage
    
    # Output results
    output_results
    
    # Exit with appropriate code
    if [[ "$OVERALL_HEALTH" == "true" ]]; then
        log "INFO" "${GREEN}" "🎉 All health checks passed!"
        exit 0
    else
        log "ERROR" "${RED}" "❌ One or more health checks failed!"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace|-n)
            NAMESPACE="$2"
            shift 2
            ;;
        --timeout|-t)
            TIMEOUT="$2"
            shift 2
            ;;
        --format|-f)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --metrics|-m)
            METRICS_OUTPUT=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -n, --namespace   Kubernetes namespace (default: lang-observatory)"
            echo "  -t, --timeout     Timeout in seconds (default: 300)"
            echo "  -f, --format      Output format: text|json|prometheus (default: text)"
            echo "  -v, --verbose     Enable verbose logging"
            echo "  -m, --metrics     Include metrics collection"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            log "ERROR" "${RED}" "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main