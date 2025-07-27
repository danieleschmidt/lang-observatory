#!/bin/bash

set -e

VERSION=${1:-patch}
DRY_RUN=${DRY_RUN:-false}
CHART_PATH="charts/lang-observatory"

echo "🚀 Starting release process..."

validate_environment() {
    echo "Validating environment..."
    
    if ! command -v helm &> /dev/null; then
        echo "❌ Helm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "❌ Git is not installed"
        exit 1
    fi
    
    if ! git diff-index --quiet HEAD --; then
        echo "❌ Working directory is not clean"
        exit 1
    fi
    
    echo "✅ Environment validation passed"
}

update_chart_version() {
    echo "Updating chart version..."
    
    CURRENT_VERSION=$(grep '^version:' $CHART_PATH/Chart.yaml | cut -d' ' -f2)
    echo "Current version: $CURRENT_VERSION"
    
    case $VERSION in
        major)
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print ($1+1)".0.0"}')
            ;;
        minor)
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."($2+1)".0"}')
            ;;
        patch)
            NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."($3+1)}')
            ;;
        *)
            NEW_VERSION=$VERSION
            ;;
    esac
    
    echo "New version: $NEW_VERSION"
    
    if [ "$DRY_RUN" = "false" ]; then
        sed -i.bak "s/^version: .*/version: $NEW_VERSION/" $CHART_PATH/Chart.yaml
        sed -i.bak "s/^appVersion: .*/appVersion: \"$NEW_VERSION\"/" $CHART_PATH/Chart.yaml
        rm -f $CHART_PATH/Chart.yaml.bak
    fi
    
    echo "✅ Chart version updated"
}

run_tests() {
    echo "Running tests..."
    
    npm test
    helm lint $CHART_PATH
    helm template test $CHART_PATH --validate
    
    echo "✅ Tests passed"
}

package_chart() {
    echo "Packaging chart..."
    
    if [ "$DRY_RUN" = "false" ]; then
        helm package $CHART_PATH
        echo "✅ Chart packaged"
    else
        echo "✅ Chart packaging skipped (dry run)"
    fi
}

update_changelog() {
    echo "Updating changelog..."
    
    if [ "$DRY_RUN" = "false" ]; then
        # Use conventional-changelog or similar tool
        if command -v conventional-changelog &> /dev/null; then
            conventional-changelog -p angular -i CHANGELOG.md -s
        else
            echo "⚠️  conventional-changelog not found, manual changelog update required"
        fi
    fi
    
    echo "✅ Changelog updated"
}

create_git_tag() {
    echo "Creating git tag..."
    
    if [ "$DRY_RUN" = "false" ]; then
        git add .
        git commit -m "chore(release): $NEW_VERSION"
        git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
        echo "✅ Git tag created"
    else
        echo "✅ Git tag creation skipped (dry run)"
    fi
}

generate_release_notes() {
    echo "Generating release notes..."
    
    cat > "release-notes-$NEW_VERSION.md" << EOF
# Release v$NEW_VERSION

## What's Changed

### Features
- [List new features here]

### Bug Fixes
- [List bug fixes here]

### Documentation
- [List documentation changes here]

### Infrastructure
- [List infrastructure changes here]

## Installation

\`\`\`bash
helm repo add terragon-charts https://terragon-labs.github.io/lang-observatory
helm install lang-observatory terragon-charts/lang-observatory --version $NEW_VERSION
\`\`\`

## Upgrade

\`\`\`bash
helm upgrade lang-observatory terragon-charts/lang-observatory --version $NEW_VERSION
\`\`\`

**Full Changelog**: https://github.com/terragon-labs/lang-observatory/compare/v$CURRENT_VERSION...v$NEW_VERSION
EOF
    
    echo "✅ Release notes generated"
}

print_next_steps() {
    echo ""
    echo "🎉 Release preparation complete!"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes and release notes"
    echo "2. Push the changes: git push origin main --tags"
    echo "3. Create GitHub release with generated notes"
    echo "4. Update Helm repository index"
    echo "5. Announce the release"
    echo ""
    echo "Files created:"
    echo "- release-notes-$NEW_VERSION.md"
    echo "- lang-observatory-$NEW_VERSION.tgz (if not dry run)"
}

# Main execution
case "$VERSION" in
    --help|-h)
        echo "Usage: $0 [major|minor|patch|x.y.z] [--dry-run]"
        echo ""
        echo "Arguments:"
        echo "  major     Increment major version (x.0.0)"
        echo "  minor     Increment minor version (x.y.0)"
        echo "  patch     Increment patch version (x.y.z) [default]"
        echo "  x.y.z     Set specific version"
        echo ""
        echo "Environment variables:"
        echo "  DRY_RUN=true  Preview changes without making them"
        exit 0
        ;;
esac

if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 Running in dry-run mode - no changes will be made"
fi

validate_environment
update_chart_version
run_tests
package_chart
update_changelog
generate_release_notes

if [ "$DRY_RUN" = "false" ]; then
    create_git_tag
fi

print_next_steps

exit 0