# Lang Observatory Makefile
# Provides standardized build, test, and deployment commands

# Variables
APP_NAME := lang-observatory
VERSION := $(shell cat package.json | jq -r '.version')
BUILD_DATE := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF := $(shell git rev-parse --short HEAD)
REGISTRY := ghcr.io/terragon-labs
IMAGE_NAME := $(REGISTRY)/$(APP_NAME)
NAMESPACE := lang-observatory

# Docker build arguments
DOCKER_BUILD_ARGS := \
	--build-arg VERSION=$(VERSION) \
	--build-arg BUILD_DATE=$(BUILD_DATE) \
	--build-arg VCS_REF=$(VCS_REF)

# Default target
.PHONY: help
help: ## Show this help message
	@echo "Lang Observatory - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
.PHONY: install
install: ## Install dependencies
	npm install
	helm dependency update ./charts/$(APP_NAME)

.PHONY: dev
dev: ## Start development environment
	docker-compose -f docker-compose.dev.yml up -d

.PHONY: dev-down
dev-down: ## Stop development environment
	docker-compose -f docker-compose.dev.yml down

# Build commands
.PHONY: build
build: ## Build the application
	npm run build

.PHONY: build-docker
build-docker: ## Build Docker image
	docker build $(DOCKER_BUILD_ARGS) -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .

.PHONY: build-chart
build-chart: ## Build Helm chart
	helm dependency update ./charts/$(APP_NAME)
	helm lint ./charts/$(APP_NAME)
	helm package ./charts/$(APP_NAME)

# Test commands
.PHONY: test
test: ## Run all tests
	npm test

.PHONY: test-unit
test-unit: ## Run unit tests
	npm run test:unit

.PHONY: test-integration
test-integration: ## Run integration tests
	npm run test:integration

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	npm run test:e2e

.PHONY: test-performance
test-performance: ## Run performance tests
	npm run test:performance

.PHONY: test-helm
test-helm: ## Test Helm chart
	npm run test:helm

.PHONY: test-security
test-security: ## Run security tests
	npm run security:scan

# Quality commands
.PHONY: lint
lint: ## Run linting
	npm run lint

.PHONY: lint-fix
lint-fix: ## Fix linting issues
	npm run lint:fix

.PHONY: format
format: ## Format code
	npm run format

.PHONY: format-fix
format-fix: ## Fix formatting issues
	npm run lint:fix

# Security commands
.PHONY: security-scan
security-scan: ## Run security scans
	npm run security:scan

.PHONY: security-trivy
security-trivy: ## Run Trivy security scan
	trivy fs --security-checks vuln,config .

.PHONY: security-docker
security-docker: ## Scan Docker image for vulnerabilities
	trivy image $(IMAGE_NAME):$(VERSION)

# Deployment commands
.PHONY: deploy-local
deploy-local: ## Deploy to local Kubernetes
	helm upgrade --install $(APP_NAME) ./charts/$(APP_NAME) \
		--namespace $(NAMESPACE) \
		--create-namespace \
		--values ./charts/$(APP_NAME)/values.yaml

.PHONY: deploy-staging
deploy-staging: ## Deploy to staging environment
	helm upgrade --install $(APP_NAME) ./charts/$(APP_NAME) \
		--namespace $(NAMESPACE)-staging \
		--create-namespace \
		--values ./charts/$(APP_NAME)/values-staging.yaml

.PHONY: deploy-production
deploy-production: ## Deploy to production environment
	helm upgrade --install $(APP_NAME) ./charts/$(APP_NAME) \
		--namespace $(NAMESPACE)-prod \
		--create-namespace \
		--values ./charts/$(APP_NAME)/values-production.yaml

# Release commands
.PHONY: release
release: ## Create a new release
	npm run release

.PHONY: tag
tag: ## Create a git tag for current version
	git tag -a v$(VERSION) -m "Release version $(VERSION)"
	git push origin v$(VERSION)

# Docker registry commands
.PHONY: push
push: build-docker ## Push Docker image to registry
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

.PHONY: pull
pull: ## Pull Docker image from registry
	docker pull $(IMAGE_NAME):$(VERSION)

# Cleanup commands
.PHONY: clean
clean: ## Clean build artifacts
	npm run clean
	rm -rf node_modules
	rm -rf coverage
	rm -rf test-results
	rm -f *.tgz

.PHONY: clean-docker
clean-docker: ## Clean Docker images and containers
	docker system prune -f
	docker image rm $(IMAGE_NAME):$(VERSION) $(IMAGE_NAME):latest || true

# Status and info commands
.PHONY: status
status: ## Show deployment status
	helm status $(APP_NAME) --namespace $(NAMESPACE)

.PHONY: logs
logs: ## Show application logs
	kubectl logs -l app.kubernetes.io/name=$(APP_NAME) -n $(NAMESPACE) --tail=100 -f

.PHONY: info
info: ## Show build information
	@echo "Application: $(APP_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Build Date: $(BUILD_DATE)"
	@echo "VCS Ref: $(VCS_REF)"
	@echo "Image: $(IMAGE_NAME):$(VERSION)"

# Health check commands
.PHONY: health
health: ## Check application health
	kubectl get pods -l app.kubernetes.io/name=$(APP_NAME) -n $(NAMESPACE)
	curl -f http://localhost:8080/health || echo "Health check failed"

# Monitoring commands
.PHONY: metrics
metrics: ## View application metrics
	curl -f http://localhost:9090/metrics || echo "Metrics endpoint unavailable"

.PHONY: dashboard
dashboard: ## Open monitoring dashboard
	@echo "Opening Grafana dashboard..."
	@echo "Grafana: http://localhost:8080"
	@echo "Prometheus: http://localhost:9090"
	@echo "Langfuse: http://localhost:3000"

# Development workflow shortcuts
.PHONY: setup
setup: install build-chart ## Initial project setup

.PHONY: check
check: lint test test-helm test-security ## Run all checks (CI equivalent)

.PHONY: ci
ci: check build build-docker ## Full CI pipeline

.PHONY: cd
cd: ci push deploy-staging ## Full CD pipeline

# Documentation
.PHONY: docs
docs: ## Generate documentation
	npm run docs:generate

.PHONY: serve-docs
serve-docs: ## Serve documentation locally
	@echo "Documentation available at:"
	@echo "README: file://$(PWD)/README.md"
	@echo "Architecture: file://$(PWD)/docs/ARCHITECTURE.md"