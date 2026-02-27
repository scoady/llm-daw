# CLAUDE.md — LLM-DAW Project Guide

## Project Overview
LLM-DAW is an AI-powered browser-based Digital Audio Workstation with MIDI keyboard input, multi-track recording, real-time synthesis (Tone.js), and AI music analysis via Claude API.

## Repository Structure
```
frontend/          React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Tone.js
backend/api/       Fastify Node.js API proxy to Claude API
infrastructure/    Helm charts, deploy scripts, k8s manifests
ci/                Jenkinsfiles (build + deploy pipelines)
scripts/           Dev convenience scripts (build, deploy, dev, test)
```

## Git Workflow
- **Always use feature branches** — never commit directly to `main`
- Branch naming: `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>`
- Create PRs to merge into `main`
- Remote: `git@github.com:scoady/llm-daw.git`

## CI/CD Architecture
- **Jenkins** runs in-cluster (namespace: `cicd`), deployed via otel-slos repo (`../otel-slos/infrastructure/helm/jenkins/`)
- **Jenkins JCasC job definitions** live in `../otel-slos/infrastructure/helm/jenkins/values.yaml`
- **RBAC**: ClusterRole `jenkins-deployer` bound to SA `jenkins` in `cicd` ns — can deploy to any namespace
- **Agent pod templates**: `kaniko` (Kaniko image builder), `helm` (alpine/helm + kubectl), `terraform`
- **In-cluster registry**: `registry.registry.svc.cluster.local:5000`
- **Build pipeline** (`ci/build.Jenkinsfile`): Kaniko parallel image builds → push to registry → trigger deploy
- **Deploy pipeline** (`ci/deploy.Jenkinsfile`): Parameterized `helm upgrade` with IMAGE_TAG → rollout verify
- **Image naming**: `registry.registry.svc.cluster.local:5000/llm-daw/{frontend,api}:<git-sha>`
- **Helm release**: `llm-daw` in namespace `llm-daw`

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand + Immer, Tone.js, Canvas rendering
- **Backend**: Fastify, TypeScript, Anthropic Claude API
- **Fonts**: Space Grotesk (UI), JetBrains Mono (code), Share Tech Mono (LCD readouts)
- **Design**: Industrial-futuristic — dark metal surfaces, LED indicators, LCD readouts, neon accent glows
- **Infra**: Kubernetes (kind for local dev), Helm 3, Kaniko (in-cluster image builds), nginx ingress

## Key Commands
```bash
make dev              # Start frontend + API dev servers
make build            # Build & push Docker images to in-cluster registry
make deploy           # First-time Helm install
make test             # Run all tests
make up               # docker-compose dev mode
```

## Roadmap
See `ROADMAP.md` for released versions, upcoming features, and backlog items. Reference it at the start of each session to understand current priorities.

## User Preferences
- Use feature branches for all new work
- Git identity: scoady / scoady@users.noreply.github.com
- No Node.js installed locally — cannot run npm/npx directly on this machine
- Prefer concise commit messages
