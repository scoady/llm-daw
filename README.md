# LLM-DAW — AI-Powered Browser DAW

A professional, browser-based Digital Audio Workstation with integrated AI music generation — similar to Soundtrap but with LLM-powered beat and loop creation.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│   React + TypeScript + Tone.js + Canvas API     │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS / WebSocket
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼────────┐       ┌──────────▼────────┐
│   Backend API   │       │    AI Service      │
│ Fastify + Node  │       │  FastAPI + Python  │
│ PostgreSQL / S3 │       │  MIDI / Beat Gen   │
└─────────────────┘       └───────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tone.js, Zustand, Tailwind CSS |
| Backend API | Node.js 20, Fastify 4, TypeScript, Prisma, PostgreSQL |
| AI Service | Python 3.11, FastAPI, midiutil, music21, Anthropic SDK |
| Storage | PostgreSQL (projects), MinIO/S3 (audio files) |
| Cache | Redis |
| Container | Docker (multi-stage builds) |
| Orchestration | Kubernetes + Helm 3 |
| CI/CD | Jenkins |

## Features

- **DAW Interface** — Arrangement view, Piano Roll, Mixer, Transport controls
- **Multi-track editing** — Audio + MIDI tracks with clips
- **Audio playback** — Web Audio API via Tone.js
- **MIDI editing** — Full piano roll with velocity, quantize
- **AI Beat Generation** — Generate drum/rhythm patterns from a sample MIDI input
- **AI Loop Generation** — Create melodic/harmonic loops from audio/MIDI seeds
- **Real-time sync** — WebSocket-based collaborative state
- **Project management** — Save/load, export, project library

## Getting Started

### Local Development

```bash
# Install all dependencies and start dev servers
make dev
```

### Build for Production

```bash
make build
```

### Docker Compose (local testing)

```bash
docker compose up
```

### Helm Deploy

```bash
make deploy ENV=staging
```

## Project Structure

```
llm-daw/
├── frontend/          # React DAW application
├── backend/
│   ├── api/           # Node.js Fastify API
│   └── ai-service/    # Python FastAPI AI service
├── helm/
│   └── llm-daw/       # Helm chart
├── scripts/           # Build & deployment scripts
├── Jenkinsfile        # CI/CD pipeline
├── Makefile           # Developer convenience targets
└── docker-compose.yml # Local orchestration
```

## Branching Strategy

- `main` — production-ready, tagged releases
- `develop` — integration branch
- `feature/*` — individual feature branches
- `hotfix/*` — production hotfixes

## CI/CD

Jenkins pipeline stages:
1. **Lint & Type-check** — ESLint, tsc, mypy
2. **Test** — Vitest (frontend), Jest (API), pytest (AI service)
3. **Build** — Docker images (multi-stage)
4. **Push** — Container registry
5. **Deploy** — Helm upgrade to target namespace

## Environment Variables

See `.env.example` files in each service directory.
