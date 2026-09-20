# SwipeDeck

A production-grade, mobile-first swipe-card discovery application built with Expo (React Native) and FastAPI.

## Architecture

```
apps/
  mobile/    # Expo SDK 52 managed workflow (React Native)
  api/       # FastAPI backend (Python 3.12)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo SDK 52 (managed), Expo Router |
| Animation/gesture | Reanimated 3 + Gesture Handler 2 |
| State management | Zustand 5 |
| Server state | TanStack Query v5 |
| Image caching | expo-image (native LRU cache) |
| Video | expo-av |
| Backend | FastAPI + Uvicorn |
| Database | PostgreSQL 16 (async via SQLAlchemy 2 + asyncpg) |
| Cache/Queue | Redis 7 |
| Object storage | S3-compatible (AWS S3 / MinIO / R2) |
| Background jobs | ARQ (async Redis task queue) |
| Video transcoding | FFmpeg (multi-bitrate HLS) |
| Auth | JWT (access 15min + refresh 7d rotation) |

---

## Prerequisites

- **Node.js** 20+, **npm** 11+
- **Python** 3.12+, **pip**
- **Docker & Docker Compose** (for local services)
- **Expo Go** app on your phone (or an Android/iOS simulator)

---

## Quick Start (Local Development)

### 1. Clone & configure

```bash
git clone https://github.com/itsradmanm/tncan.git
cd tncan
```

### 2. Start backend services

```bash
cd apps/api
cp .env.example .env
# Edit .env — replace APP_SECRET_KEY with a secure random value

docker-compose up -d postgres redis minio
```

### 3. Run database migrations

```bash
pip install -r requirements.txt
alembic upgrade head
```

### 4. Create the MinIO bucket

```bash
# Open MinIO console at http://localhost:9001
# Login: minioadmin / minioadmin
# Create bucket named: swiped-media
```

### 5. Start the API server

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 6. Start the ARQ worker (for media processing)

```bash
python -m arq app.workers.tasks.WorkerSettings
```

### 7. Start the mobile app

```bash
cd apps/mobile
cp .env.example .env.local
# Edit EXPO_PUBLIC_API_BASE_URL if needed

npm install
npm start
```

Scan the QR code with Expo Go, or press `w` for the web preview.

---

## Environment Variables

### API (`apps/api/.env`)

See [`apps/api/.env.example`](apps/api/.env.example) for the full reference.

Critical variables:
- `APP_SECRET_KEY` — must be a random 64-char hex string in production
- `DATABASE_URL` — PostgreSQL async URL (`postgresql+asyncpg://...`)
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- `CDN_BASE_URL` — public base URL for media assets

### Mobile (`apps/mobile/.env.local`)

See [`apps/mobile/.env.example`](apps/mobile/.env.example).

- `EXPO_PUBLIC_API_BASE_URL` — no trailing slash

---

## Running Tests

### Backend

```bash
cd apps/api
pytest tests/ -v
```

Runs without a live database (pure unit tests only).

### Frontend

```bash
cd apps/mobile
npm run test:ci
```

Tests cover all swipe physics pure functions (rotation, tint opacity, commit thresholds, direction detection).

---

## Linting & Type Checking

### Backend

```bash
cd apps/api
ruff check .
mypy app/ --ignore-missing-imports
```

### Frontend

```bash
cd apps/mobile
npm run lint
npm run typecheck
```

---

## Production Deployment

### API

```bash
cd apps/api
docker-compose up -d
```

The Dockerfile produces a production image with FFmpeg, libmagic, 4 Uvicorn workers, and a non-root user.

### Mobile (EAS Build)

1. Create an [EAS](https://expo.dev/eas) account
2. Replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`
3. Run: `npx eas build --platform all`

---

## Key Design Decisions

1. **Swipe gesture runs on the UI thread** (Reanimated 3 worklets) — non-negotiable for 60fps on mid-range Android.
2. **Buttons share the exact same animation path as gesture swipes** — `triggerSwipe()` calls the same worklet-based exit, not a separate code path.
3. **Decisions are append-only** — SwipeDecision records are never updated after creation.
4. **Idempotent decisions** — client generates a UUID; retrying the same request is safe (returns 200).
5. **S3 direct upload** — binary never passes through the API server; presigned PUT URLs are used.
6. **BlurHash placeholders** — decoded instantly from a compact string, shown before any network image data arrives.

---

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `backend.yml` — ruff + mypy + pytest on every push/PR to `apps/api/`
- `frontend.yml` — ESLint + TypeScript + Jest on every push/PR to `apps/mobile/`

---

## Project Structure

```
apps/
  api/
    main.py                 # FastAPI app factory
    app/
      core/                 # config, database, redis, security, deps
      models/               # SQLAlchemy ORM models
      schemas/              # Pydantic v2 schemas
      api/routers/          # auth, cards, decisions, media
      services/             # card_feed, media
      workers/tasks.py      # ARQ tasks (media processing, queue replenish)
    alembic/                # Database migrations
    tests/                  # Unit tests
    docker-compose.yml
    Dockerfile
  mobile/
    app/                    # Expo Router screens
      _layout.tsx           # Root layout (GestureHandlerRootView, QueryProvider)
      (tabs)/index.tsx      # Main swipe screen
      (tabs)/history.tsx    # Decision history
      auth/login.tsx
      auth/register.tsx
    src/
      api/                  # client, queries, mutations, types
      components/
        Deck/               # Card, SwipeDeck
        Media/              # MediaImage, MediaVideo, MediaGallery
        ui/                 # Button, TintOverlay, SwipeBadge
      hooks/                # useSwipeGesture, useUndoStack, usePrefetchQueue
      state/                # deckStore, sessionStore
      theme/                # tokens, colors, useTheme
    __tests__/              # Jest unit tests
```
