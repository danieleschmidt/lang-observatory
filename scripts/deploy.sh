#!/bin/bash
set -euo pipefail

# Lang Observatory Deployment Script
# Supports Docker Compose and Kubernetes deployments

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT="production"
DEPLOYMENT_TYPE="docker"
NAMESPACE="lang-observatory"
DRY_RUN=false
VERBOSE=false
FORCE=false

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

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Lang Observatory to Docker or Kubernetes

OPTIONS:
    -e, --environment   Environment (production, staging, development) [default: production]
    -t, --type         Deployment type (docker, kubernetes, helm) [default: docker]
    -n, --namespace    Kubernetes namespace [default: lang-observatory]
    -d, --dry-run      Show what would be deployed without actually deploying
    -v, --verbose      Enable verbose output
    -f, --force        Force deployment even if validation fails
    -h, --help         Show this help message

EXAMPLES:
    $0 --environment production --type docker
    $0 --type kubernetes --namespace my-namespace --dry-run
    $0 --type helm --environment staging

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--type)
                DEPLOYMENT_TYPE="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Validate environment
validate_environment() {
    log_info "Validating environment: $ENVIRONMENT"
    
    case $ENVIRONMENT in
        production|staging|development)
            log_success "Environment '$ENVIRONMENT' is valid"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for $DEPLOYMENT_TYPE deployment"
    
    case $DEPLOYMENT_TYPE in
        docker)
            check_docker_prerequisites
            ;;
        kubernetes)
            check_kubernetes_prerequisites
            ;;
        helm)
            check_helm_prerequisites
            ;;
        *)
            log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
            exit 1
            ;;
    esac
}

check_docker_prerequisites() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Docker prerequisites met"
}

check_kubernetes_prerequisites() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Kubernetes prerequisites met"
}

check_helm_prerequisites() {
    check_kubernetes_prerequisites
    
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed"
        exit 1
    fi
    
    log_success "Helm prerequisites met"
}

# Generate environment file
generate_env_file() {
    local env_file="$PROJECT_ROOT/.env.$ENVIRONMENT"
    
    if [[ ! -f "$env_file" ]] || [[ "$FORCE" == "true" ]]; then
        log_info "Generating environment file: $env_file"
        
        cat > "$env_file" << EOF
# Lang Observatory Environment Configuration
# Environment: $ENVIRONMENT
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Application
NODE_ENV=$ENVIRONMENT
LOG_LEVEL=info
APP_PORT=3000

# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=$(openssl rand -base64 32)
REDIS_PORT=6379

# Langfuse
LANGFUSE_PORT=3001
NEXTAUTH_SECRET=$(openssl rand -base64 32)
LANGFUSE_SALT=$(openssl rand -hex 32)
LANGFUSE_ENCRYPTION_KEY=$(openssl rand -hex 32)
LANGFUSE_PUBLIC_KEY=pk-lf-$(openssl rand -hex 16)
LANGFUSE_SECRET_KEY=sk-lf-$(openssl rand -hex 32)

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3002
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)

# OpenTelemetry
OTEL_GRPC_PORT=4317
OTEL_HTTP_PORT=4318
OTEL_METRICS_PORT=8889
OTEL_HEALTH_PORT=13133

# Load Balancer
HTTP_PORT=80
HTTPS_PORT=443

# Logging
FLUENTD_PORT=24224
EOF
        
        log_success "Environment file generated: $env_file"
        log_warning "Please review and customize the generated environment file"
    else
        log_info "Environment file already exists: $env_file"
    fi
}

# Build Docker images
build_docker_images() {
    log_info "Building Docker images"
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would build Docker image"
        return
    fi
    
    docker build -f docker/Dockerfile.production -t lang-observatory:latest .
    
    log_success "Docker images built successfully"
}

# Deploy with Docker Compose
deploy_docker() {
    log_info "Starting Docker Compose deployment"
    
    cd "$PROJECT_ROOT"
    
    # Build images
    build_docker_images
    
    # Generate environment file
    generate_env_file
    
    local compose_file="docker/docker-compose.production.yml"
    local env_file=".env.$ENVIRONMENT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run: docker-compose -f $compose_file --env-file $env_file up -d"
        docker-compose -f "$compose_file" --env-file "$env_file" config
        return
    fi
    
    # Deploy
    docker-compose -f "$compose_file" --env-file "$env_file" up -d
    
    # Wait for services to be ready
    wait_for_docker_services
    
    log_success "Docker Compose deployment completed"
    show_docker_endpoints
}

# Wait for Docker services
wait_for_docker_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3000/api/health > /dev/null; then
            log_success "Services are ready"
            return
        fi
        
        log_info "Attempt $attempt/$max_attempts: Services not ready yet, waiting..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Services failed to become ready within timeout"
    exit 1
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Starting Kubernetes deployment"
    
    # Create namespace
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create namespace: $NAMESPACE"
    else
        kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    # Apply manifests
    local manifests_dir="$PROJECT_ROOT/deployment/kubernetes/base"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would apply manifests from: $manifests_dir"
        kubectl apply -f "$manifests_dir" --dry-run=client -o yaml
        return
    fi
    
    kubectl apply -f "$manifests_dir" -n "$NAMESPACE"
    
    # Wait for deployment
    wait_for_kubernetes_deployment
    
    log_success "Kubernetes deployment completed"
    show_kubernetes_endpoints
}

# Wait for Kubernetes deployment
wait_for_kubernetes_deployment() {
    log_info "Waiting for Kubernetes deployment to be ready..."
    
    kubectl wait --for=condition=available --timeout=600s deployment/lang-observatory -n "$NAMESPACE"
    
    log_success "Kubernetes deployment is ready"
}

# Deploy with Helm
deploy_helm() {
    log_info "Starting Helm deployment"
    
    local chart_dir="$PROJECT_ROOT/charts/lang-observatory"
    local values_file="$chart_dir/values-$ENVIRONMENT.yaml"
    
    # Create values file if it doesn't exist
    if [[ ! -f "$values_file" ]]; then
        cp "$chart_dir/values.yaml" "$values_file"
        log_warning "Created $values_file from default values. Please customize as needed."
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run Helm deployment"
        helm upgrade --install lang-observatory "$chart_dir" \
            --namespace "$NAMESPACE" \
            --create-namespace \
            --values "$values_file" \
            --dry-run --debug
        return
    fi
    
    # Deploy with Helm
    helm upgrade --install lang-observatory "$chart_dir" \
        --namespace "$NAMESPACE" \
        --create-namespace \
        --values "$values_file" \
        --wait --timeout=10m
    
    log_success "Helm deployment completed"
    show_helm_status
}

# Show Docker endpoints
show_docker_endpoints() {
    cat << EOF

${GREEN}🎉 Lang Observatory is now running!${NC}

${BLUE}📊 Service Endpoints:${NC}
  • Application:    http://localhost:3000
  • Langfuse UI:    http://localhost:3001
  • Grafana:        http://localhost:3002 (admin/admin)
  • Prometheus:     http://localhost:9090
  • Load Balancer:  http://localhost (if configured)

${BLUE}🔍 Useful Commands:${NC}
  • View logs:      docker-compose -f docker/docker-compose.production.yml logs -f
  • Stop services:  docker-compose -f docker/docker-compose.production.yml down
  • Restart:        docker-compose -f docker/docker-compose.production.yml restart

EOF
}

# Show Kubernetes endpoints
show_kubernetes_endpoints() {
    cat << EOF

${GREEN}🎉 Lang Observatory is deployed to Kubernetes!${NC}

${BLUE}🔍 Useful Commands:${NC}
  • Check status:   kubectl get pods -n $NAMESPACE
  • View logs:      kubectl logs -f deployment/lang-observatory -n $NAMESPACE
  • Port forward:   kubectl port-forward svc/lang-observatory 3000:3000 -n $NAMESPACE

${BLUE}📊 Access the application:${NC}
  • Run: kubectl port-forward svc/lang-observatory 3000:3000 -n $NAMESPACE
  • Then visit: http://localhost:3000

EOF
}

# Show Helm status
show_helm_status() {
    helm status lang-observatory -n "$NAMESPACE"
    
    cat << EOF

${BLUE}🔍 Useful Commands:${NC}
  • Check status:   helm status lang-observatory -n $NAMESPACE
  • View values:    helm get values lang-observatory -n $NAMESPACE
  • Upgrade:        helm upgrade lang-observatory charts/lang-observatory -n $NAMESPACE

EOF
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
}

# Set up signal handlers
trap cleanup EXIT

# Main execution
main() {
    log_info "Starting Lang Observatory deployment"
    log_info "Environment: $ENVIRONMENT, Type: $DEPLOYMENT_TYPE"
    
    parse_args "$@"
    validate_environment
    check_prerequisites
    
    case $DEPLOYMENT_TYPE in
        docker)
            deploy_docker
            ;;
        kubernetes)
            deploy_kubernetes
            ;;
        helm)
            deploy_helm
            ;;
    esac
    
    log_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"