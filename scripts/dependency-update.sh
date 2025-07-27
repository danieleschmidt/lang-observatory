#!/bin/bash

set -e

UPDATE_TYPE=${1:-minor}
DRY_RUN=${DRY_RUN:-false}
AUTO_MERGE=${AUTO_MERGE:-false}

echo "🔄 Starting dependency update process..."

update_helm_dependencies() {
    echo "Updating Helm chart dependencies..."
    
    if [ "$DRY_RUN" = "false" ]; then
        helm repo update
        helm dependency update ./charts/lang-observatory
        echo "✅ Helm dependencies updated"
    else
        echo "✅ Helm dependency update skipped (dry run)"
    fi
}

update_npm_dependencies() {
    echo "Checking NPM dependencies..."
    
    if [ -f "package.json" ]; then
        case $UPDATE_TYPE in
            major)
                UPDATE_FLAG="--latest"
                ;;
            minor)
                UPDATE_FLAG="--upgrade"
                ;;
            patch)
                UPDATE_FLAG="--patch"
                ;;
            security)
                UPDATE_FLAG="--only=security"
                ;;
            *)
                UPDATE_FLAG="--upgrade"
                ;;
        esac
        
        if command -v npm-check-updates &> /dev/null; then
            if [ "$DRY_RUN" = "false" ]; then
                ncu $UPDATE_FLAG -u
                npm install
                echo "✅ NPM dependencies updated"
            else
                ncu $UPDATE_FLAG
                echo "✅ NPM dependency check completed (dry run)"
            fi
        else
            if [ "$DRY_RUN" = "false" ]; then
                npm update
                echo "✅ NPM dependencies updated (using npm update)"
            else
                npm outdated || true
                echo "✅ NPM outdated check completed (dry run)"
            fi
        fi
    else
        echo "⚠️  No package.json found, skipping NPM updates"
    fi
}

check_security_vulnerabilities() {
    echo "Checking for security vulnerabilities..."
    
    if [ -f "package.json" ]; then
        if [ "$DRY_RUN" = "false" ]; then
            npm audit --audit-level=moderate || true
            npm audit fix || true
            echo "✅ Security audit completed"
        else
            npm audit --audit-level=moderate || true
            echo "✅ Security audit check completed (dry run)"
        fi
    fi
    
    # Check Helm chart security
    if command -v trivy &> /dev/null; then
        trivy fs --security-checks vuln,config ./charts/lang-observatory || true
        echo "✅ Helm chart security scan completed"
    fi
}

update_docker_images() {
    echo "Checking for Docker image updates..."
    
    VALUES_FILE="./charts/lang-observatory/values.yaml"
    
    if [ -f "$VALUES_FILE" ]; then
        # Extract image tags and check for updates
        grep -E "tag:|image:" "$VALUES_FILE" | while read -r line; do
            echo "Image reference: $line"
        done
        
        echo "⚠️  Docker image updates require manual verification"
        echo "   Please check the values.yaml file for outdated image tags"
    fi
}

run_tests() {
    echo "Running tests after updates..."
    
    if [ "$DRY_RUN" = "false" ]; then
        npm test || {
            echo "❌ Tests failed after dependency updates"
            echo "   Please review and fix any breaking changes"
            exit 1
        }
        echo "✅ Tests passed after updates"
    else
        echo "✅ Test execution skipped (dry run)"
    fi
}

create_update_report() {
    echo "Generating dependency update report..."
    
    TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
    REPORT_FILE="dependency-update-report-$TIMESTAMP.md"
    
    cat > "$REPORT_FILE" << EOF
# Dependency Update Report

**Generated:** $(date)
**Update Type:** $UPDATE_TYPE
**Dry Run:** $DRY_RUN

## Changes Made

### Helm Dependencies
$(helm dependency list ./charts/lang-observatory 2>/dev/null || echo "No Helm dependencies found")

### NPM Dependencies
$([ -f "package.json" ] && npm list --depth=0 || echo "No NPM dependencies found")

### Security Issues
$([ -f "package.json" ] && npm audit --audit-level=moderate 2>/dev/null | head -20 || echo "No security audit data")

## Recommendations

1. **Review Changes**: Check all updated dependencies for breaking changes
2. **Test Thoroughly**: Run comprehensive tests in staging environment
3. **Security Review**: Address any high/critical security vulnerabilities
4. **Documentation**: Update documentation if APIs have changed
5. **Rollback Plan**: Ensure rollback procedures are ready

## Next Steps

- [ ] Review this report
- [ ] Test changes in staging
- [ ] Update documentation if needed
- [ ] Deploy to production
- [ ] Monitor for issues

EOF
    
    echo "✅ Update report generated: $REPORT_FILE"
}

create_pr_if_auto_merge() {
    if [ "$AUTO_MERGE" = "true" ] && [ "$DRY_RUN" = "false" ]; then
        echo "Creating pull request for dependency updates..."
        
        if git diff --quiet; then
            echo "No changes to commit"
            return 0
        fi
        
        BRANCH_NAME="chore/dependency-updates-$(date +%Y%m%d)"
        
        git checkout -b "$BRANCH_NAME"
        git add .
        git commit -m "chore: update dependencies ($UPDATE_TYPE)

- Update Helm chart dependencies
- Update NPM dependencies  
- Fix security vulnerabilities
- Update Docker image references (if applicable)

Automated dependency update performed on $(date)"
        
        if command -v gh &> /dev/null; then
            gh pr create \
                --title "chore: dependency updates ($UPDATE_TYPE)" \
                --body "Automated dependency update.

## Changes
- Helm dependencies updated
- NPM packages updated
- Security vulnerabilities addressed

## Testing
- [x] Automated tests passing
- [ ] Manual testing required
- [ ] Security review completed

## Deployment
- [ ] Ready for staging deployment
- [ ] Ready for production deployment" \
                --label "dependencies,automated" \
                --assignee "@me"
            
            echo "✅ Pull request created"
        else
            echo "⚠️  GitHub CLI not found, manual PR creation required"
            echo "   Branch: $BRANCH_NAME"
        fi
    fi
}

print_summary() {
    echo ""
    echo "🎉 Dependency update process complete!"
    echo ""
    echo "Summary:"
    echo "- Update type: $UPDATE_TYPE"
    echo "- Dry run: $DRY_RUN"
    echo "- Auto merge: $AUTO_MERGE"
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        echo "This was a dry run. To apply changes, run:"
        echo "  DRY_RUN=false $0 $UPDATE_TYPE"
    else
        echo "Changes have been applied. Next steps:"
        echo "1. Review the update report"
        echo "2. Test changes thoroughly"
        echo "3. Commit and push changes"
        echo "4. Deploy to staging/production"
    fi
}

# Main execution
case "$UPDATE_TYPE" in
    --help|-h)
        echo "Usage: $0 [major|minor|patch|security] [options]"
        echo ""
        echo "Update types:"
        echo "  major      Major version updates (breaking changes possible)"
        echo "  minor      Minor version updates (new features, backward compatible)"
        echo "  patch      Patch version updates (bug fixes only)"
        echo "  security   Security updates only"
        echo ""
        echo "Environment variables:"
        echo "  DRY_RUN=true       Preview changes without applying them"
        echo "  AUTO_MERGE=true    Automatically create PR for changes"
        echo ""
        echo "Examples:"
        echo "  $0 minor                    # Update minor versions"
        echo "  DRY_RUN=true $0 major      # Preview major updates"
        echo "  AUTO_MERGE=true $0 security # Update security and create PR"
        exit 0
        ;;
esac

if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 Running in dry-run mode - no changes will be made"
fi

update_helm_dependencies
update_npm_dependencies
check_security_vulnerabilities
update_docker_images

if [ "$DRY_RUN" = "false" ]; then
    run_tests
fi

create_update_report
create_pr_if_auto_merge
print_summary

exit 0