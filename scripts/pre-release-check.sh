#!/bin/bash

set -e

echo "🚀 Pre-release validation for Lang Observatory..."

RELEASE_VERSION=${1:-"auto"}
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_SECURITY=${SKIP_SECURITY:-false}

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
TOTAL_CHECKS=0

check_result() {
    local check_name=$1
    local result=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$result" = "0" ]; then
        echo -e "✅ ${GREEN}$check_name: PASSED${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo -e "❌ ${RED}$check_name: FAILED${NC}"
    fi
}

echo "📋 Checking release readiness..."

# Check 1: Clean git status
echo "🔍 Checking git status..."
if git diff --quiet && git diff --staged --quiet; then
    check_result "Git Status Clean" 0
else
    echo -e "⚠️  ${YELLOW}Warning: Uncommitted changes detected${NC}"
    check_result "Git Status Clean" 1
fi

# Check 2: On main branch
echo "🔍 Checking current branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
    check_result "On Main Branch" 0
else
    echo -e "⚠️  ${YELLOW}Warning: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    check_result "On Main Branch" 1
fi

# Check 3: Up to date with remote
echo "🔍 Checking if branch is up to date..."
git fetch origin
if git diff --quiet HEAD origin/main; then
    check_result "Up to Date with Remote" 0
else
    check_result "Up to Date with Remote" 1
fi

# Check 4: Dependencies are up to date
echo "🔍 Checking dependencies..."
if npm ci > /dev/null 2>&1; then
    check_result "Dependencies Install" 0
else
    check_result "Dependencies Install" 1
fi

# Check 5: Linting passes
echo "🔍 Running linters..."
if npm run lint > /dev/null 2>&1; then
    check_result "Linting" 0
else
    check_result "Linting" 1
fi

# Check 6: Tests pass (if not skipped)
if [ "$SKIP_TESTS" != "true" ]; then
    echo "🔍 Running tests..."
    if npm test > /dev/null 2>&1; then
        check_result "Tests" 0
    else
        check_result "Tests" 1
    fi
else
    echo "⏭️  Skipping tests"
fi

# Check 7: Helm chart validation
echo "🔍 Validating Helm chart..."
if helm lint ./charts/lang-observatory > /dev/null 2>&1; then
    check_result "Helm Chart Lint" 0
else
    check_result "Helm Chart Lint" 1
fi

if helm template ./charts/lang-observatory --validate > /dev/null 2>&1; then
    check_result "Helm Chart Template" 0
else
    check_result "Helm Chart Template" 1
fi

# Check 8: Security scans (if not skipped)
if [ "$SKIP_SECURITY" != "true" ]; then
    echo "🔍 Running security scans..."
    if ./scripts/security-scan.sh > /dev/null 2>&1; then
        check_result "Security Scan" 0
    else
        check_result "Security Scan" 1
    fi
else
    echo "⏭️  Skipping security scans"
fi

# Check 9: Version consistency
echo "🔍 Checking version consistency..."
PACKAGE_VERSION=$(node -p "require('./package.json').version")
CHART_VERSION=$(yq eval '.version' charts/lang-observatory/Chart.yaml)

if [ "$PACKAGE_VERSION" = "$CHART_VERSION" ]; then
    check_result "Version Consistency" 0
else
    echo -e "⚠️  ${YELLOW}Version mismatch: package.json=$PACKAGE_VERSION, Chart.yaml=$CHART_VERSION${NC}"
    check_result "Version Consistency" 1
fi

# Check 10: Changelog updated
echo "🔍 Checking changelog..."
if [ -f "CHANGELOG.md" ] && [ "$(head -n 5 CHANGELOG.md | grep -c "$(date +'%Y-%m-%d')\|Unreleased\|TBD")" -gt 0 ]; then
    check_result "Changelog Updated" 0
else
    check_result "Changelog Updated" 1
fi

# Check 11: Documentation is current
echo "🔍 Checking documentation..."
DOCS_UPDATED=0
if [ -f "README.md" ] && [ -f "docs/ARCHITECTURE.md" ] && [ -f "docs/DEPLOYMENT.md" ]; then
    DOCS_UPDATED=1
fi

check_result "Core Documentation Exists" $((1-DOCS_UPDATED))

# Check 12: No TODO or FIXME comments in critical files
echo "🔍 Checking for TODO/FIXME in critical files..."
TODO_COUNT=$(grep -r "TODO\|FIXME" charts/ scripts/ --exclude-dir=node_modules --exclude="*.log" | wc -l)
if [ "$TODO_COUNT" -eq 0 ]; then
    check_result "No Critical TODOs" 0
else
    echo -e "⚠️  ${YELLOW}Found $TODO_COUNT TODO/FIXME comments${NC}"
    check_result "No Critical TODOs" 1
fi

# Summary
echo ""
echo "=========================================="
echo "         PRE-RELEASE CHECK SUMMARY"
echo "=========================================="
echo "Checks Passed: $CHECKS_PASSED/$TOTAL_CHECKS"

if [ "$CHECKS_PASSED" -eq "$TOTAL_CHECKS" ]; then
    echo -e "🎉 ${GREEN}All pre-release checks passed! Ready for release.${NC}"
    
    if [ "$RELEASE_VERSION" != "auto" ]; then
        echo "📝 Suggested release commands:"
        echo "  git tag v$RELEASE_VERSION"
        echo "  git push origin v$RELEASE_VERSION"
        echo "  npm run release"
    else
        echo "📝 Suggested release command:"
        echo "  npm run release"
    fi
    
    exit 0
else
    FAILED_CHECKS=$((TOTAL_CHECKS - CHECKS_PASSED))
    echo -e "❌ ${RED}$FAILED_CHECKS checks failed. Please fix issues before releasing.${NC}"
    
    echo ""
    echo "Common fixes:"
    echo "- Run 'npm run lint:fix' to fix linting issues"
    echo "- Run 'npm test' to see test failures"
    echo "- Run 'git add . && git commit' to commit changes"
    echo "- Update CHANGELOG.md with release notes"
    echo "- Ensure version numbers are consistent across files"
    
    exit 1
fi