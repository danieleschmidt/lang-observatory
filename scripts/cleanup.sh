#!/bin/bash

set -e

CLEANUP_TYPE=${1:-standard}
FORCE=${FORCE:-false}
DRY_RUN=${DRY_RUN:-false}

echo "🧹 Starting cleanup process..."

cleanup_docker() {
    echo "Cleaning up Docker resources..."
    
    if command -v docker &> /dev/null; then
        if [ "$DRY_RUN" = "false" ]; then
            # Remove dangling images
            docker image prune -f
            
            # Remove unused containers
            docker container prune -f
            
            # Remove unused networks
            docker network prune -f
            
            # Remove unused volumes (if forced)
            if [ "$FORCE" = "true" ]; then
                docker volume prune -f
            fi
            
            echo "✅ Docker cleanup completed"
        else
            echo "Would clean up Docker resources (dry run)"
        fi
    else
        echo "⚠️  Docker not found, skipping Docker cleanup"
    fi
}

cleanup_npm() {
    echo "Cleaning up NPM resources..."
    
    if [ -f "package.json" ] && command -v npm &> /dev/null; then
        if [ "$DRY_RUN" = "false" ]; then
            # Clear NPM cache
            npm cache clean --force
            
            # Remove node_modules if forced
            if [ "$FORCE" = "true" ] && [ -d "node_modules" ]; then
                rm -rf node_modules
                npm install
            fi
            
            echo "✅ NPM cleanup completed"
        else
            echo "Would clean up NPM cache and node_modules (dry run)"
        fi
    else
        echo "⚠️  No package.json found or NPM not available"
    fi
}

cleanup_helm() {
    echo "Cleaning up Helm resources..."
    
    if command -v helm &> /dev/null; then
        if [ "$DRY_RUN" = "false" ]; then
            # Clean up chart dependencies
            if [ -d "charts/lang-observatory/charts" ]; then
                rm -rf charts/lang-observatory/charts/*
            fi
            
            # Remove chart lock file if forced
            if [ "$FORCE" = "true" ] && [ -f "charts/lang-observatory/Chart.lock" ]; then
                rm charts/lang-observatory/Chart.lock
            fi
            
            # Remove packaged charts
            rm -f *.tgz
            
            echo "✅ Helm cleanup completed"
        else
            echo "Would clean up Helm charts and dependencies (dry run)"
        fi
    else
        echo "⚠️  Helm not found, skipping Helm cleanup"
    fi
}

cleanup_test_artifacts() {
    echo "Cleaning up test artifacts..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Remove coverage reports
        rm -rf coverage/
        
        # Remove test reports
        rm -rf test-results/
        
        # Remove Jest cache
        if command -v npx &> /dev/null; then
            npx jest --clearCache || true
        fi
        
        # Remove temporary test files
        find . -name "*.test.tmp" -delete 2>/dev/null || true
        find . -name "test-*.log" -delete 2>/dev/null || true
        
        echo "✅ Test artifacts cleanup completed"
    else
        echo "Would clean up test artifacts (dry run)"
    fi
}

cleanup_logs() {
    echo "Cleaning up log files..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Remove log files
        find . -name "*.log" -not -path "./node_modules/*" -delete 2>/dev/null || true
        find . -name "npm-debug.log*" -delete 2>/dev/null || true
        find . -name "yarn-debug.log*" -delete 2>/dev/null || true
        find . -name "yarn-error.log*" -delete 2>/dev/null || true
        
        # Clean up application logs directory
        if [ -d "logs" ]; then
            rm -rf logs/*
        fi
        
        echo "✅ Log cleanup completed"
    else
        echo "Would clean up log files (dry run)"
    fi
}

cleanup_security_reports() {
    echo "Cleaning up security reports..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Remove old security reports (keep last 5)
        if [ -d "security-reports" ]; then
            find security-reports/ -name "*.json" -o -name "*.txt" -o -name "*.md" | \
                sort -r | tail -n +6 | xargs rm -f 2>/dev/null || true
        fi
        
        echo "✅ Security reports cleanup completed"
    else
        echo "Would clean up old security reports (dry run)"
    fi
}

cleanup_kubernetes_resources() {
    echo "Cleaning up Kubernetes test resources..."
    
    if command -v kubectl &> /dev/null; then
        if [ "$DRY_RUN" = "false" ]; then
            # Remove test namespaces
            kubectl delete namespace lang-observatory-test --ignore-not-found=true
            kubectl delete namespace lang-observatory-e2e --ignore-not-found=true
            
            # Clean up test deployments
            kubectl delete deployment,service,configmap,secret -l app.kubernetes.io/instance=test --all-namespaces --ignore-not-found=true
            
            echo "✅ Kubernetes cleanup completed"
        else
            echo "Would clean up Kubernetes test resources (dry run)"
        fi
    else
        echo "⚠️  kubectl not found, skipping Kubernetes cleanup"
    fi
}

cleanup_build_artifacts() {
    echo "Cleaning up build artifacts..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Remove build directories
        rm -rf dist/
        rm -rf build/
        rm -rf .next/
        
        # Remove compiled files
        find . -name "*.pyc" -delete 2>/dev/null || true
        find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
        
        # Remove OS generated files
        find . -name ".DS_Store" -delete 2>/dev/null || true
        find . -name "Thumbs.db" -delete 2>/dev/null || true
        
        echo "✅ Build artifacts cleanup completed"
    else
        echo "Would clean up build artifacts (dry run)"
    fi
}

cleanup_git() {
    echo "Cleaning up Git resources..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Git garbage collection
        git gc --prune=now --aggressive || true
        
        # Clean up Git rerere cache if forced
        if [ "$FORCE" = "true" ]; then
            git rerere clear || true
        fi
        
        # Remove merged branches (if forced)
        if [ "$FORCE" = "true" ]; then
            git branch --merged | grep -v "\*\|main\|master\|develop" | xargs -n 1 git branch -d 2>/dev/null || true
        fi
        
        echo "✅ Git cleanup completed"
    else
        echo "Would clean up Git resources (dry run)"
    fi
}

generate_cleanup_report() {
    echo "Generating cleanup report..."
    
    TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
    REPORT_FILE="cleanup-report-$TIMESTAMP.md"
    
    cat > "$REPORT_FILE" << EOF
# Cleanup Report

**Generated:** $(date)
**Cleanup Type:** $CLEANUP_TYPE
**Force Mode:** $FORCE
**Dry Run:** $DRY_RUN

## Cleanup Actions Performed

### Docker
- Removed dangling images
- Removed unused containers
- Removed unused networks
$([ "$FORCE" = "true" ] && echo "- Removed unused volumes")

### NPM
- Cleared NPM cache
$([ "$FORCE" = "true" ] && echo "- Reinstalled node_modules")

### Helm
- Removed chart dependencies
- Removed packaged charts
$([ "$FORCE" = "true" ] && echo "- Removed Chart.lock file")

### Test Artifacts
- Removed coverage reports
- Removed test results
- Cleared Jest cache
- Removed temporary test files

### Logs
- Removed application logs
- Removed debug logs
- Removed error logs

### Security Reports
- Cleaned up old security reports (kept last 5)

### Kubernetes
- Removed test namespaces
- Cleaned up test deployments

### Build Artifacts
- Removed build directories
- Removed compiled files
- Removed OS generated files

### Git
- Performed garbage collection
$([ "$FORCE" = "true" ] && echo "- Cleared rerere cache" && echo "- Removed merged branches")

## Disk Space Recovered

Before cleanup:
$(df -h . | tail -1)

## Next Steps

1. **Verify**: Ensure all necessary files are still present
2. **Test**: Run basic functionality tests
3. **Rebuild**: Run build processes if needed
4. **Monitor**: Watch for any issues after cleanup

EOF
    
    echo "✅ Cleanup report generated: $REPORT_FILE"
}

print_summary() {
    echo ""
    echo "🎉 Cleanup process complete!"
    echo ""
    echo "Summary:"
    echo "- Cleanup type: $CLEANUP_TYPE"
    echo "- Force mode: $FORCE"
    echo "- Dry run: $DRY_RUN"
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        echo "This was a dry run. To apply cleanup, run:"
        echo "  DRY_RUN=false $0 $CLEANUP_TYPE"
    else
        echo "Cleanup completed successfully!"
        echo "Check the cleanup report for details."
    fi
}

# Main execution
case "$CLEANUP_TYPE" in
    --help|-h)
        echo "Usage: $0 [standard|deep|docker|test|all] [options]"
        echo ""
        echo "Cleanup types:"
        echo "  standard   Standard cleanup (safe, default)"
        echo "  deep       Deep cleanup (removes more files)"
        echo "  docker     Docker-specific cleanup only"
        echo "  test       Test artifacts cleanup only"
        echo "  all        All cleanup operations"
        echo ""
        echo "Environment variables:"
        echo "  DRY_RUN=true    Preview cleanup without making changes"
        echo "  FORCE=true      Force removal of additional files"
        echo ""
        echo "Examples:"
        echo "  $0 standard                 # Standard cleanup"
        echo "  DRY_RUN=true $0 deep       # Preview deep cleanup"
        echo "  FORCE=true $0 all          # Aggressive cleanup"
        exit 0
        ;;
esac

if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 Running in dry-run mode - no changes will be made"
fi

case "$CLEANUP_TYPE" in
    standard)
        cleanup_test_artifacts
        cleanup_logs
        cleanup_build_artifacts
        ;;
    deep)
        cleanup_test_artifacts
        cleanup_logs
        cleanup_build_artifacts
        cleanup_npm
        cleanup_helm
        cleanup_security_reports
        ;;
    docker)
        cleanup_docker
        ;;
    test)
        cleanup_test_artifacts
        cleanup_kubernetes_resources
        ;;
    all)
        cleanup_docker
        cleanup_npm
        cleanup_helm
        cleanup_test_artifacts
        cleanup_logs
        cleanup_security_reports
        cleanup_kubernetes_resources
        cleanup_build_artifacts
        cleanup_git
        ;;
    *)
        echo "❌ Unknown cleanup type: $CLEANUP_TYPE"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

generate_cleanup_report
print_summary

exit 0