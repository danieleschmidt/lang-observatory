#!/bin/bash

set -e

SCAN_TYPE=${SCAN_TYPE:-all}
OUTPUT_DIR=${OUTPUT_DIR:-./security-reports}
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")

echo "🔒 Starting security scan for Lang Observatory..."

mkdir -p "$OUTPUT_DIR"

scan_filesystem() {
    echo "Scanning filesystem for vulnerabilities..."
    
    if command -v trivy &> /dev/null; then
        trivy fs --format json --output "$OUTPUT_DIR/trivy-fs-$TIMESTAMP.json" .
        trivy fs --format table --output "$OUTPUT_DIR/trivy-fs-$TIMESTAMP.txt" .
        echo "✅ Filesystem scan completed"
    else
        echo "⚠️  Trivy not found, skipping filesystem scan"
    fi
}

scan_docker_image() {
    echo "Scanning Docker image for vulnerabilities..."
    
    if command -v trivy &> /dev/null && command -v docker &> /dev/null; then
        if docker image inspect lang-observatory:latest &> /dev/null; then
            trivy image --format json --output "$OUTPUT_DIR/trivy-image-$TIMESTAMP.json" lang-observatory:latest
            trivy image --format table --output "$OUTPUT_DIR/trivy-image-$TIMESTAMP.txt" lang-observatory:latest
            echo "✅ Docker image scan completed"
        else
            echo "⚠️  Docker image not found, skipping image scan"
        fi
    else
        echo "⚠️  Trivy or Docker not found, skipping image scan"
    fi
}

scan_kubernetes_configs() {
    echo "Scanning Kubernetes configurations..."
    
    if command -v kubesec &> /dev/null; then
        find charts/ -name "*.yaml" -type f | while read -r file; do
            filename=$(basename "$file" .yaml)
            kubesec scan "$file" > "$OUTPUT_DIR/kubesec-$filename-$TIMESTAMP.json"
        done
        echo "✅ Kubernetes config scan completed"
    else
        echo "⚠️  Kubesec not found, skipping Kubernetes config scan"
    fi
}

scan_secrets() {
    echo "Scanning for secrets and sensitive data..."
    
    if command -v gitleaks &> /dev/null; then
        gitleaks detect --source . --report-format json --report-path "$OUTPUT_DIR/gitleaks-$TIMESTAMP.json" || true
        echo "✅ Secrets scan completed"
    else
        echo "⚠️  Gitleaks not found, skipping secrets scan"
    fi
}

scan_dependencies() {
    echo "Scanning dependencies for vulnerabilities..."
    
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        npm audit --json > "$OUTPUT_DIR/npm-audit-$TIMESTAMP.json" 2>/dev/null || true
        npm audit > "$OUTPUT_DIR/npm-audit-$TIMESTAMP.txt" 2>/dev/null || true
        echo "✅ NPM dependency scan completed"
    else
        echo "⚠️  NPM not found or no package.json, skipping dependency scan"
    fi
}

generate_security_report() {
    echo "Generating security summary report..."
    
    cat > "$OUTPUT_DIR/security-summary-$TIMESTAMP.md" << EOF
# Security Scan Summary

**Generated:** $(date)
**Scan Type:** $SCAN_TYPE

## Scan Results

### Filesystem Vulnerabilities
$([ -f "$OUTPUT_DIR/trivy-fs-$TIMESTAMP.txt" ] && echo "✅ Completed - see trivy-fs-$TIMESTAMP.txt" || echo "⚠️  Not performed")

### Docker Image Vulnerabilities
$([ -f "$OUTPUT_DIR/trivy-image-$TIMESTAMP.txt" ] && echo "✅ Completed - see trivy-image-$TIMESTAMP.txt" || echo "⚠️  Not performed")

### Kubernetes Configuration Security
$([ -f "$OUTPUT_DIR/kubesec-"*"-$TIMESTAMP.json" ] && echo "✅ Completed - see kubesec-*-$TIMESTAMP.json files" || echo "⚠️  Not performed")

### Secrets Detection
$([ -f "$OUTPUT_DIR/gitleaks-$TIMESTAMP.json" ] && echo "✅ Completed - see gitleaks-$TIMESTAMP.json" || echo "⚠️  Not performed")

### Dependency Vulnerabilities
$([ -f "$OUTPUT_DIR/npm-audit-$TIMESTAMP.txt" ] && echo "✅ Completed - see npm-audit-$TIMESTAMP.txt" || echo "⚠️  Not performed")

## Recommendations

1. Review all HIGH and CRITICAL vulnerabilities
2. Update dependencies with known vulnerabilities
3. Address any secrets or sensitive data exposure
4. Implement security patches for container images
5. Review Kubernetes security configurations

## Next Steps

- Schedule regular security scans (weekly recommended)
- Set up automated vulnerability monitoring
- Implement security policies in CI/CD pipeline
- Review and update security baselines quarterly
EOF

    echo "✅ Security summary generated"
}

case $SCAN_TYPE in
    "filesystem"|"fs")
        scan_filesystem
        ;;
    "docker"|"image")
        scan_docker_image
        ;;
    "kubernetes"|"k8s")
        scan_kubernetes_configs
        ;;
    "secrets")
        scan_secrets
        ;;
    "dependencies"|"deps")
        scan_dependencies
        ;;
    "all")
        scan_filesystem
        scan_docker_image
        scan_kubernetes_configs
        scan_secrets
        scan_dependencies
        ;;
    *)
        echo "Usage: $0 [filesystem|docker|kubernetes|secrets|dependencies|all]"
        exit 1
        ;;
esac

generate_security_report

echo "🎉 Security scan complete! Reports saved to $OUTPUT_DIR"

exit 0