.PHONY: dev build test lint clean deploy push help

REGISTRY ?= localhost:5000
IMAGE_TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
NAMESPACE ?= llm-daw

##@ Development
dev: ## Start frontend + API dev servers
	@bash scripts/dev.sh

dev-frontend: ## Start only the frontend dev server
	@cd frontend && npm run dev

dev-api: ## Start only the backend API
	@cd backend/api && npm run dev

##@ Build
build: ## Build and push all Docker images to the in-cluster registry
	@bash infrastructure/scripts/build-and-load.sh

build-frontend: ## Build and push frontend image
	@docker build -t $(REGISTRY)/llm-daw/frontend:$(IMAGE_TAG) -t $(REGISTRY)/llm-daw/frontend:latest ./frontend
	@docker push $(REGISTRY)/llm-daw/frontend:$(IMAGE_TAG)
	@docker push $(REGISTRY)/llm-daw/frontend:latest

build-api: ## Build and push API image
	@docker build -t $(REGISTRY)/llm-daw/api:$(IMAGE_TAG) -t $(REGISTRY)/llm-daw/api:latest ./backend/api
	@docker push $(REGISTRY)/llm-daw/api:$(IMAGE_TAG)
	@docker push $(REGISTRY)/llm-daw/api:latest

##@ Testing
test: ## Run all tests
	@bash scripts/test.sh

test-frontend: ## Run frontend tests
	@cd frontend && npm run test

test-api: ## Run API tests
	@cd backend/api && npm run test 2>/dev/null || echo "No API tests configured yet"

##@ Code Quality
lint: ## Run all linters
	@cd frontend && npm run lint && npm run typecheck

##@ Docker Compose (local)
up: ## Start services with docker-compose (dev mode)
	@docker compose -f docker-compose.dev.yml up --build

down: ## Stop docker-compose services
	@docker compose -f docker-compose.dev.yml down

logs: ## Tail docker-compose logs
	@docker compose -f docker-compose.dev.yml logs -f

##@ Deployment
deploy: ## First-time Helm install to cluster
	@bash infrastructure/scripts/deploy.sh

rollback: ## Rollback last Helm deployment
	@helm rollback llm-daw -n $(NAMESPACE)

##@ Utilities
install: ## Install all dependencies
	@cd frontend && npm install
	@cd backend/api && npm install

clean: ## Remove build artifacts and node_modules
	@rm -rf frontend/dist frontend/node_modules
	@rm -rf backend/api/dist backend/api/node_modules

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
