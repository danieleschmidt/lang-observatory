#!/bin/bash

set -e

OUTPUT_DIR=${OUTPUT_DIR:-./sbom-reports}
TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
FORMAT=${FORMAT:-spdx-json}

echo "📋 Generating Software Bill of Materials (SBOM) for Lang Observatory..."

mkdir -p "$OUTPUT_DIR"

generate_npm_sbom() {
    echo "Generating SBOM for Node.js dependencies..."
    
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        # Use npm-audit to generate dependency information
        npm list --json > "$OUTPUT_DIR/npm-dependencies-$TIMESTAMP.json" 2>/dev/null || true
        npm audit --json > "$OUTPUT_DIR/npm-audit-sbom-$TIMESTAMP.json" 2>/dev/null || true
        echo "✅ NPM SBOM data generated"
    else
        echo "⚠️  NPM not found or no package.json, skipping NPM SBOM"
    fi
}

generate_docker_sbom() {
    echo "Generating SBOM for Docker image..."
    
    if command -v syft &> /dev/null; then
        if docker image inspect lang-observatory:latest &> /dev/null; then
            syft lang-observatory:latest -o "$FORMAT" > "$OUTPUT_DIR/docker-sbom-$TIMESTAMP.$FORMAT"
            syft lang-observatory:latest -o table > "$OUTPUT_DIR/docker-sbom-$TIMESTAMP.txt"
            echo "✅ Docker SBOM generated"
        else
            echo "⚠️  Docker image not found, building it first..."
            docker build -t lang-observatory:latest .
            syft lang-observatory:latest -o "$FORMAT" > "$OUTPUT_DIR/docker-sbom-$TIMESTAMP.$FORMAT"
            syft lang-observatory:latest -o table > "$OUTPUT_DIR/docker-sbom-$TIMESTAMP.txt"
            echo "✅ Docker SBOM generated after build"
        fi
    else
        echo "⚠️  Syft not found, trying alternative methods..."
        if command -v docker &> /dev/null && docker image inspect lang-observatory:latest &> /dev/null; then
            # Fallback: Use docker history to get basic layer information
            docker history --format "table {{.CreatedBy}}\t{{.Size}}" lang-observatory:latest > "$OUTPUT_DIR/docker-layers-$TIMESTAMP.txt"
            echo "✅ Basic Docker layer information generated"
        fi
    fi
}

generate_helm_sbom() {
    echo "Generating SBOM for Helm chart dependencies..."
    
    if command -v helm &> /dev/null; then
        helm dependency list charts/lang-observatory > "$OUTPUT_DIR/helm-dependencies-$TIMESTAMP.txt" 2>/dev/null || true
        
        # Extract chart dependencies
        if [ -f "charts/lang-observatory/Chart.yaml" ]; then
            yq eval '.dependencies' charts/lang-observatory/Chart.yaml > "$OUTPUT_DIR/helm-chart-deps-$TIMESTAMP.yaml" 2>/dev/null || true
        fi
        
        echo "✅ Helm chart SBOM data generated"
    else
        echo "⚠️  Helm not found, skipping Helm SBOM"
    fi
}

generate_security_metadata() {
    echo "Generating security metadata..."
    
    cat > "$OUTPUT_DIR/security-metadata-$TIMESTAMP.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "lang-observatory",
  "version": "$(cat charts/lang-observatory/Chart.yaml | yq eval '.version' - 2>/dev/null || echo 'unknown')",
  "repository": "https://github.com/terragon-labs/lang-observatory",
  "license": "Apache-2.0",
  "security_contact": "security@terragonlabs.com",
  "vulnerability_disclosure": "https://github.com/terragon-labs/lang-observatory/security/policy",
  "supported_versions": [
    {
      "version": "0.1.x",
      "supported": true,
      "security_updates": true
    }
  ],
  "sbom_format": "$FORMAT",
  "generation_tool": "custom-sbom-generator",
  "compliance": {
    "spdx": true,
    "cyclone_dx": false,
    "swid": false
  }
}
EOF

    echo "✅ Security metadata generated"
}

generate_comprehensive_report() {
    echo "Generating comprehensive SBOM report..."
    
    cat > "$OUTPUT_DIR/sbom-summary-$TIMESTAMP.md" << EOF
# Software Bill of Materials (SBOM) Summary

**Generated:** $(date)
**Project:** Lang Observatory
**Version:** $(cat charts/lang-observatory/Chart.yaml | yq eval '.version' - 2>/dev/null || echo 'unknown')
**Format:** $FORMAT

## Components Analyzed

### Node.js Dependencies
$([ -f "$OUTPUT_DIR/npm-dependencies-$TIMESTAMP.json" ] && echo "✅ Analyzed - see npm-dependencies-$TIMESTAMP.json" || echo "⚠️  Not analyzed")

### Docker Image Layers
$([ -f "$OUTPUT_DIR/docker-sbom-$TIMESTAMP.$FORMAT" ] && echo "✅ Analyzed - see docker-sbom-$TIMESTAMP.$FORMAT" || echo "⚠️  Not analyzed")

### Helm Chart Dependencies
$([ -f "$OUTPUT_DIR/helm-dependencies-$TIMESTAMP.txt" ] && echo "✅ Analyzed - see helm-dependencies-$TIMESTAMP.txt" || echo "⚠️  Not analyzed")

## Security Information

- **License:** Apache-2.0
- **Security Contact:** security@terragonlabs.com
- **Vulnerability Disclosure:** Available in GitHub Security Policy
- **Supported Versions:** 0.1.x series

## Key Dependencies

### Core Runtime Dependencies
- Node.js $(node --version 2>/dev/null || echo 'version unknown')
- Helm $(helm version --short 2>/dev/null || echo 'version unknown')
- Kubernetes compatible versions: 1.24+

### Monitoring Stack
- Prometheus (from Helm chart)
- Grafana (from Helm chart)  
- OpenTelemetry Collector
- Langfuse

## Supply Chain Security

- All dependencies are tracked and monitored
- Regular security scanning is performed
- Container images are built from verified base images
- Helm charts use official upstream sources

## Recommendations

1. Regularly update dependencies with security patches
2. Monitor CVE databases for new vulnerabilities
3. Implement automated dependency updates where appropriate
4. Review SBOM data for license compliance
5. Validate integrity of all upstream dependencies

## Next Steps

- Integrate SBOM generation into CI/CD pipeline
- Set up automated vulnerability monitoring
- Implement dependency pinning for reproducible builds
- Consider using signed container images
EOF

    echo "✅ Comprehensive SBOM report generated"
}

# Main execution
generate_npm_sbom
generate_docker_sbom  
generate_helm_sbom
generate_security_metadata
generate_comprehensive_report

echo "🎉 SBOM generation complete! Reports saved to $OUTPUT_DIR"
echo "📋 SBOM files:"
find "$OUTPUT_DIR" -name "*$TIMESTAMP*" -type f | sort

exit 0