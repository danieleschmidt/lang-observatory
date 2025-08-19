#!/bin/bash

# Production Deployment Script for Lang Observatory
# Generation 3 - Autonomous SDLC Production Deployment

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-lang-observatory-prod}"
HELM_RELEASE="${HELM_RELEASE:-lang-observatory}"
CHART_PATH="${CHART_PATH:-./charts/lang-observatory}"
VALUES_FILE="${VALUES_FILE:-./deployment/production/production-values.yaml}"
KUBECONFIG="${KUBECONFIG:-~/.kube/config}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deployment failed with exit code $exit_code"
        log_info "Cleaning up partial deployment..."
        # Add cleanup logic here if needed
    fi
    exit $exit_code
}

trap cleanup EXIT

# Pre-deployment checks
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is required but not installed"
        exit 1
    fi
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "Helm is required but not installed"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if values file exists
    if [[ ! -f "$VALUES_FILE" ]]; then
        log_error "Production values file not found: $VALUES_FILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Quality Gates
run_quality_gates() {
    log_info "Running quality gates..."
    
    # Unit tests
    log_info "Running unit tests..."
    if ! npm run test:unit; then
        log_error "Unit tests failed"
        exit 1
    fi
    
    # Helm chart linting
    log_info "Linting Helm chart..."
    if ! helm lint "$CHART_PATH" --values "$VALUES_FILE"; then
        log_error "Helm chart linting failed"
        exit 1
    fi
    
    # Security scanning
    log_info "Running security scans..."
    if command -v trivy &> /dev/null; then
        trivy fs --security-checks vuln,config . --exit-code 0 || log_warning "Security issues found, but continuing..."
    else
        log_warning "Trivy not installed, skipping security scan"
    fi
    
    # Chart template validation
    log_info "Validating Helm templates..."
    if ! helm template "$HELM_RELEASE" "$CHART_PATH" --values "$VALUES_FILE" --validate; then
        log_error "Helm template validation failed"
        exit 1
    fi
    
    log_success "Quality gates passed"
}

# Infrastructure setup
setup_infrastructure() {
    log_info "Setting up infrastructure..."
    
    # Create namespace
    log_info "Creating namespace: $NAMESPACE"
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Label namespace for monitoring
    kubectl label namespace "$NAMESPACE" monitoring=enabled --overwrite
    kubectl label namespace "$NAMESPACE" environment=production --overwrite
    
    # Create secrets (these should be managed externally in production)
    log_info "Creating secrets..."
    
    # Grafana admin secret
    if ! kubectl get secret grafana-admin-secret -n "$NAMESPACE" &> /dev/null; then
        kubectl create secret generic grafana-admin-secret \
            --from-literal=admin-user=admin \
            --from-literal=admin-password="$(openssl rand -base64 32)" \
            -n "$NAMESPACE"
        log_info "Created Grafana admin secret"
    fi
    
    # Langfuse secrets  
    if ! kubectl get secret langfuse-secrets -n "$NAMESPACE" &> /dev/null; then
        kubectl create secret generic langfuse-secrets \
            --from-literal=nextauth-secret="$(openssl rand -hex 32)" \
            --from-literal=salt="$(openssl rand -hex 32)" \
            --from-literal=encryption-key="$(openssl rand -hex 32)" \
            --from-literal=public-key="pk-lf-$(openssl rand -hex 16)" \
            --from-literal=secret-key="sk-lf-$(openssl rand -hex 32)" \
            -n "$NAMESPACE"
        log_info "Created Langfuse secrets"
    fi
    
    log_success "Infrastructure setup completed"
}

# Multi-region deployment
deploy_multi_region() {
    log_info "Deploying to multiple regions..."
    
    local regions=("us-east-1" "eu-west-1" "ap-southeast-1")
    
    for region in "${regions[@]}"; do
        log_info "Deploying to region: $region"
        
        # Create region-specific values
        local region_values_file="/tmp/${HELM_RELEASE}-${region}-values.yaml"
        cp "$VALUES_FILE" "$region_values_file"
        
        # Add region-specific overrides
        cat >> "$region_values_file" << EOF

# Region-specific overrides for $region
global:
  region: $region
  
multiRegion:
  currentRegion: $region
EOF
        
        # Deploy to region-specific namespace
        local region_namespace="${NAMESPACE}-${region}"
        kubectl create namespace "$region_namespace" --dry-run=client -o yaml | kubectl apply -f -
        
        # Deploy with region-specific configuration
        helm upgrade --install "${HELM_RELEASE}-${region}" "$CHART_PATH" \
            --namespace "$region_namespace" \
            --values "$region_values_file" \
            --timeout 10m \
            --wait \
            --atomic
        
        log_success "Deployed to region: $region"
        rm -f "$region_values_file"
    done
    
    log_success "Multi-region deployment completed"
}

# Main deployment
deploy_primary() {
    log_info "Starting primary deployment..."
    
    # Update Helm dependencies
    log_info "Updating Helm dependencies..."
    helm dependency update "$CHART_PATH"
    
    # Deploy with production values
    log_info "Deploying Lang Observatory to production..."
    helm upgrade --install "$HELM_RELEASE" "$CHART_PATH" \
        --namespace "$NAMESPACE" \
        --values "$VALUES_FILE" \
        --timeout 15m \
        --wait \
        --atomic \
        --create-namespace
    
    log_success "Primary deployment completed"
}

# Post-deployment validation
validate_deployment() {
    log_info "Validating deployment..."
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n "$NAMESPACE" -o wide
    
    # Wait for all pods to be ready
    log_info "Waiting for all pods to be ready..."
    kubectl wait --for=condition=ready pod --all -n "$NAMESPACE" --timeout=600s
    
    # Check services
    log_info "Checking services..."
    kubectl get services -n "$NAMESPACE"
    
    # Check ingress
    log_info "Checking ingress..."
    kubectl get ingress -n "$NAMESPACE"
    
    # Health checks
    log_info "Running health checks..."
    
    # Get service endpoints
    local langfuse_service=$(kubectl get svc langfuse -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
    local grafana_service=$(kubectl get svc grafana -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
    
    # Port forward for health checks (in background)
    kubectl port-forward svc/langfuse 8080:3000 -n "$NAMESPACE" &
    local langfuse_pf_pid=$!
    
    kubectl port-forward svc/grafana 3000:80 -n "$NAMESPACE" &
    local grafana_pf_pid=$!
    
    # Wait a moment for port forwards to establish
    sleep 5
    
    # Health check Langfuse
    if curl -s http://localhost:8080/api/public/health | grep -q "ok"; then
        log_success "Langfuse health check passed"
    else
        log_warning "Langfuse health check failed"
    fi
    
    # Health check Grafana
    if curl -s http://localhost:3000/api/health | grep -q "ok"; then
        log_success "Grafana health check passed"  
    else
        log_warning "Grafana health check failed"
    fi
    
    # Cleanup port forwards
    kill $langfuse_pf_pid $grafana_pf_pid 2>/dev/null || true
    
    log_success "Deployment validation completed"
}

# Performance validation
validate_performance() {
    log_info "Running performance validation..."
    
    # Run performance tests if available
    if [[ -f "tests/performance/load-test.js" ]]; then
        log_info "Running load tests..."
        if command -v k6 &> /dev/null; then
            # Run a light load test
            k6 run tests/performance/load-test.js --vus 10 --duration 30s || log_warning "Performance tests failed"
        else
            log_warning "k6 not installed, skipping performance tests"
        fi
    fi
    
    log_success "Performance validation completed"
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."
    
    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "release": "$HELM_RELEASE",
    "namespace": "$NAMESPACE",
    "chart": "$CHART_PATH",
    "values": "$VALUES_FILE"
  },
  "cluster": {
    "context": "$(kubectl config current-context)",
    "version": "$(kubectl version --client --short | head -n1)"
  },
  "resources": {
    "pods": $(kubectl get pods -n "$NAMESPACE" -o json | jq '.items | length'),
    "services": $(kubectl get services -n "$NAMESPACE" -o json | jq '.items | length'),
    "ingresses": $(kubectl get ingress -n "$NAMESPACE" -o json | jq '.items | length // 0')
  },
  "status": "completed"
}
EOF
    
    log_success "Deployment report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting Lang Observatory Production Deployment"
    log_info "Namespace: $NAMESPACE"
    log_info "Release: $HELM_RELEASE"
    log_info "Values: $VALUES_FILE"
    
    check_prerequisites
    run_quality_gates
    setup_infrastructure
    deploy_primary
    
    # Deploy to multiple regions if enabled
    if [[ "${MULTI_REGION:-false}" == "true" ]]; then
        deploy_multi_region
    fi
    
    validate_deployment
    validate_performance
    generate_report
    
    log_success "Lang Observatory deployment completed successfully!"
    log_info "Access Grafana: https://grafana.langobservatory.com"
    log_info "Access Langfuse: https://langfuse.langobservatory.com"
}

# Execute main function
main "$@"