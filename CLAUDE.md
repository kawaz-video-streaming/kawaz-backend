# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # ts-node-dev with hot reload, loads .env automatically

# Build
npm run build         # rimraf dist + tsc
npm run build:watch   # tsc --watch (no clean)
npm run build:advanced # full reset: rimraf dist + node_modules + package-lock, then npm i + tsc

# Clean
npm run clean         # rimraf dist
npm run clean:advanced # rimraf dist + node_modules + package-lock.json

# Testing
npm test              # build then jest --runInBand --verbose

# Start
npm start             # node dist/index.js, loads .env automatically (requires prior build)
npm run start:dev     # build then start (no hot reload)
```

To run a single test file:
```bash
npx jest --config jest.config.js src/api/media/__tests__/index.test.ts --verbose
```

## Architecture

This is a **media upload microservice** with two main processing paths:

1. **HTTP API** (`src/api/`) — Accepts file uploads, saves metadata to MongoDB (status: "pending"), publishes AMQP message (with temp file path) to trigger background processing.
2. **AMQP Consumer** (`src/background/`) — Two consumers:
   - **Upload** (`src/background/upload/`) — Listens for upload events, uploads file to S3 (`uploadMediaHandler`), then on success triggers video conversion / updates status and cleans up the temp file (`uploadSuccessHandler`). Storage errors are wrapped as `UploadError` (retriable via `AmqpRetriableError`).
   - **Progress** (`src/background/progress/`) — Listens for progress events and updates media status to `"completed"` or `"failed"`.

### Request Flow

```
POST /media/upload
  → Multer (temp file saved to ./tmp)
  → Validate request (Zod)
  → Save media record to MongoDB (status: "pending")
  → Publish to AMQP exchange "upload", topic "upload.media" (includes temp file path)
  → Return 200 { message: "Media Started Uploading" }

AMQP consumer (exchange: "upload", topic: "upload.media")
  → Validate payload (Zod)
  → uploadMediaHandler: Upload file to storage (S3) from temp path
      → On StorageError: throw UploadError (retriable, max 3 retries)
  → uploadSuccessHandler (handleSuccess):
      → For video: Update media status → "processing", publish to "convert" exchange
      → For image: Update media status → "completed"
      → Delete temp file
  → On fatal error: Delete temp file
```

### HTTP Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | No | Register a new user, sets `kawaz-token` HttpOnly cookie |
| `POST` | `/auth/login` | No | Login, sets `kawaz-token` HttpOnly cookie |
| `POST` | `/auth/promote` | No (x-admin-secret header) | Promote a user to admin role |
| `GET` | `/auth/me` | Yes | Returns the authenticated user's info (`username`, `role`) |
| `POST` | `/media/upload` | Yes (admin only, via `kawaz-token` cookie) | Upload a video file (multipart/form-data); video mimetype only |
| `GET` | `/media/videos` | Yes | List all videos metadata (via VOD service) |
| `GET` | `/media/videos/:id` | Yes | Get a single video's metadata (via VOD service) |
| `GET` | `/media/videos/:id/manifest` | Yes | Get HLS manifest for a video |
| `GET` | `/media/videos/:id/segments/:filename` | Yes | Get URL for a specific video segment |
| `GET` | `/media/videos/:id/vtt/:filename` | Yes | Get VTT subtitle content for a video |
| `GET` | `/health` | No | Health check — returns 200 OK |
| `GET` | `/api-docs` | No | Swagger UI (OpenAPI documentation) |

### Media Model (`src/dal/media/model.ts`)

```ts
interface Media {
  name: string;           // original filename
  type: string;           // MIME type
  size: number;           // file size in bytes
  status: MediaStatus;    // "pending" | "processing" | "completed" | "failed"
  includesSubtitles?: boolean;
}
```

The upload request accepts an optional `includeSubtitles` field which is stored on the media record.

### System Initialization (`src/services/system.ts`)

Wires everything together:
- `StorageClient` (S3-compatible)
- `VodClient` (VOD service, config via `createVodClientConfig()`)
- Two `AmqpClient` instances — one for publishing (API), one for consuming (background)
- MongoDB connection + DALs
- AMQP consumers
- HTTP server with routes

### Key Internal Packages

All `@ido_kawaz/*` packages are listed as **devDependencies** (resolved locally via npm workspaces or local paths).

| Package | Purpose |
|---|---|
| `@ido_kawaz/server-framework` | Express-based HTTP framework with decorators |
| `@ido_kawaz/mongo-client` | MongoDB/Mongoose wrapper with base `Dal` class |
| `@ido_kawaz/amqp-client` | RabbitMQ client (publish/consume) |
| `@ido_kawaz/storage-client` | S3-compatible storage client |
| `@ido_kawaz/vod-client` | VOD service client (`getVideos`, `getVideoById`, `getManifest`, `getSegmentUrl`, `getVtt`) |

### Patterns

- **Factory functions** for all modules: `createMediaHandlers(deps)`, `createUploadConsumer(deps)`, etc.
- **Zod validation** at every boundary: HTTP requests (`validateMediaUploadRequest`), AMQP payloads (`validateUploadPayload`), and env config (`src/config.ts`).
- **DAL pattern**: Each entity has a DAL class extending the framework's base `Dal`. Media: `createMedia()`, `updateMediaStatus()`. User: `createUser()`, `findUser()`, `verifyUser()`.
- **Colocated tests**: `__tests__/` directories next to the source they test.
- **Handler decorator** from server-framework wraps route handlers for logging and error propagation.

### Configuration

All env vars are validated at startup via Zod in `src/config.ts`. An `InvalidConfigError` is thrown with a descriptive message if any required var is missing or invalid. The `SystemConfig` interface is the single source of truth for runtime config shape.

Service-specific env vars validated in `src/config.ts`:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No (default: `"development"`) | `"development"` \| `"local"` \| `"test"` |
| `UPLOAD_STORAGE_BUCKET` | Yes | S3 bucket name for uploads |
| `UPLOAD_STORAGE_KEY_PREFIX` | Yes | Key prefix for uploaded objects |
| `JWT_SECRET` | Yes | Secret for signing/verifying JWT tokens |

Additional env vars are consumed by the internal packages (`createServerConfig()`, `createMongoConfig()`, `createAmqpConfig()`, `createStorageConfig()`) — refer to each package's documentation for their required variables.

### AMQP Exchange/Topic Conventions

- Upload API publishes: exchange `upload`, topic `upload.media`
- Upload consumer publishes (video): exchange `convert`, topic defined in `src/background/upload/binding.ts`
- Progress consumer listens: exchange `progress`, topic `progress.media` (updates media status to `"completed"` or `"failed"`)
