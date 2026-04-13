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
   - **Progress** (`src/background/progress/`) — Listens for progress events, updates media `status` and `percentage` for any of the four statuses (`pending`, `processing`, `completed`, `failed`); saves video `metadata` only when status is `"completed"`.

### Request Flow

```
POST /media/upload  (multipart: fields file + thumbnail, both required)
  → Multer (temp files saved to ./tmp)
  → Validate request (Zod) — requires video file + image thumbnail
  → Save media record to MongoDB (status: "pending", thumbnailFocalPoint stored)
  → Publish to AMQP exchange "upload", topic "upload.media"
      (includes mediaPath + thumbnailPath)
  → Return 200 { message: "Media Started Uploading" }

AMQP consumer (exchange: "upload", topic: "upload.media")
  → Validate payload (Zod)
  → uploadMediaHandler(storageClient, config): Upload media + thumbnail to S3
      → media → <uploadPrefix>/<fileName>  (multipart if size > partSize)
      → thumbnail → <thumbnailPrefix>/<mediaId>.jpg
      → On StorageError: throw UploadError (retriable, max 3 retries)
  → uploadSuccessHandler(amqpClient, mediaDal, config):
      → Always: publish to "convert" exchange, update media status → "processing"
      → Delete temp media file and temp thumbnail file
  → On fatal error: Delete temp file
```

### HTTP Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | No | Register a new user, sets `kawaz-token` HttpOnly cookie |
| `POST` | `/auth/login` | No | Login, sets `kawaz-token` HttpOnly cookie |
| `POST` | `/auth/promote` | No (x-admin-secret header) | Promote a user to admin role |
| `GET` | `/user/me` | Yes | Returns the authenticated user's info (`username`, `role`) |
| `POST` | `/user/profile` | Yes | Create a profile for the authenticated user |
| `PUT` | `/user/profile` | Yes | Update the avatar of an existing profile (matched by `profileName`) |
| `DELETE` | `/user/profile/:name` | Yes | Delete one of the authenticated user's profiles |
| `GET` | `/user/profiles` | Yes | List all profiles for the authenticated user |
| `GET` | `/avatar` | Yes | List all avatars |
| `GET` | `/avatar/:id` | Yes | Get a single avatar's metadata |
| `GET` | `/avatar/:id/image` | Yes | Redirect to presigned avatar image URL |
| `POST` | `/avatar` | Yes (admin only) | Create an avatar with image upload |
| `DELETE` | `/avatar/:id` | Yes (admin only) | Delete an avatar from DB and storage |
| `POST` | `/media/upload` | Yes (admin only) | Upload video + thumbnail (multipart/form-data); returns `{ message, mediaId }` |
| `GET` | `/media` | Yes | List all completed media from MongoDB |
| `GET` | `/media/uploading` | Yes | List all non-completed media (pending/processing/failed) |
| `GET` | `/media/:id` | Yes | Get a single media's metadata from MongoDB |
| `GET` | `/media/:id/progress` | Yes | Get upload progress `{ status, percentage }` for a media item |
| `PUT` | `/media/:id` | Yes (admin only) | Update media title, description, tags, thumbnail image, or thumbnail focal point |
| `DELETE` | `/media/:id` | Yes (admin only) | Delete media from DB and VOD storage |
| `GET` | `/media/:id/thumbnail` | Yes | Redirect to presigned thumbnail URL |
| `GET` | `/media/stream/:id/output.mpd` | Yes | Stream MPEG-DASH manifest from VOD storage bucket |
| `GET` | `/media/stream/:id/:filename.m4s` | Yes | Redirect to presigned URL for a video segment |
| `GET` | `/media/stream/:id/:filename.vtt` | Yes | Stream VTT subtitle file from VOD storage bucket |
| `GET` | `/media/stream/:id/thumbnails.jpg` | Yes | Stream sprite-sheet tile thumbnails image from VOD storage bucket |
| `POST` | `/media-collection` | Yes (admin only) | Create a collection with a required thumbnail |
| `GET` | `/media-collection` | Yes | List all media collections |
| `GET` | `/media-collection/:id` | Yes | Get a single collection's metadata |
| `PUT` | `/media-collection/:id` | Yes (admin only) | Update collection title, description, tags, thumbnail image, or thumbnail focal point |
| `DELETE` | `/media-collection/:id` | Yes (admin only) | Delete a collection (must be empty) |
| `GET` | `/media-collection/:id/thumbnail` | Yes | Redirect to presigned thumbnail URL |
| `GET` | `/health` | No | Health check — returns 200 OK |
| `GET` | `/api-docs` | No | Swagger UI (OpenAPI documentation) |

### Media Model (`src/dal/media/model.ts`)

```ts
interface Media {
  _id: string;
  fileName: string;              // original filename
  title: string;                 // user-provided display title
  description?: string;
  tags: MediaTag[];              // e.g. "Action", "Comedy", etc.
  size: number;                  // file size in bytes
  status: MediaStatus;           // "pending" | "processing" | "completed" | "failed"
  percentage: number;            // upload progress 0–100; set by upload/progress consumers
  thumbnailFocalPoint: Coordinates; // { x, y } crop anchor, defaults to { x: 0.5, y: 0.5 }
  collectionId?: string;         // optional parent collection
  metadata?: MediaMetadata;      // populated by progress consumer on completion; includes thumbnailsUrl
}
```

### MediaCollection Model (`src/dal/mediaCollection/model.ts`)

```ts
interface MediaCollection {
  _id: string;
  title: string;
  description?: string;
  tags: MediaTag[];
  thumbnailFocalPoint: Coordinates;
  collectionId?: string;         // optional parent collection (nesting)
}
```

Deletion is blocked if the collection still contains media or subcollections (`CollectionNotEmptyError`).

Thumbnail is uploaded to storage at key `<thumbnailPrefix>/<mediaId>.jpg` by the upload consumer. The `thumbnailFocalPoint` is stored in the DB and used downstream for cropping.

`MediaMetadata` contains name, durationInMs, playUrl, chaptersUrl, chapters, videoStreams, audioStreams, and subtitleStreams — populated when the progress consumer receives a completed event from the media processor.

### System Initialization (`src/services/system.ts`)

Wires everything together:
- `StorageClient` (S3-compatible, shared between upload consumer and media API)
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
| `@ido_kawaz/vod-client` | VOD service client (streaming routes only — manifest, segment, VTT) |

### Patterns

- **Factory functions** for all modules: `createMediaHandlers(deps)`, `createUploadConsumer(deps)`, etc.
- **Zod validation** at every boundary: HTTP requests (`validateMediaUploadRequest`), AMQP payloads (`validateUploadPayload`), and env config (`src/config.ts`). The `validateRequest(schema)` factory in `src/utils/zod.ts` parses the full `req` object (not `req.body`) — schemas must match the Express request shape (`{ body, files, params, ... }`).
- **Nullable update fields**: `description` and `collectionId` use `z.string().nullish()` — sending `null` triggers a MongoDB `$unset`, omitting the field leaves the DB value unchanged.
- **Shared types**: `MEDIA_TAGS`, `MediaTag`, `AVATAR_CATEGORIES`, `AvatarCategory`, `BucketsConfig`, `Coordinates`, `UploadedFile`, `RequestWithIdParam` are defined in `src/utils/types.ts` and shared across modules.
- **BucketsConfig**: All storage bucket names and key prefixes are consolidated into a single `BucketsConfig` object (see `src/utils/types.ts`) passed down to media, mediaCollection, and upload consumer — no per-feature config interfaces for storage.
- **DAL pattern**: Each entity has a DAL class extending the framework's base `Dal`. Media: `createMedia(MediaInfo)`, `updateMedia()`, `deleteMedia()`, `getAllMedia()`, `getMedia()`, `isCollectionEmpty()`. MediaCollection: `createCollection()`, `updateCollection()`, `deleteCollection()`, `getAllCollections()`, `getCollection()`, `isCollectionEmpty()`. User: `createUser()`, `findUser()`, `verifyUser()`. Avatar: `createAvatar()`, `deleteAvatar()`, `getAllAvatars()`, `getAvatarById()`.
- **Colocated tests**: `__tests__/` directories next to the source they test.
- **Handler decorator** from server-framework wraps route handlers for logging and error propagation.

### Configuration

All env vars are validated at startup via Zod in `src/config.ts`. An `InvalidConfigError` is thrown with a descriptive message if any required var is missing or invalid. The `SystemConfig` interface is the single source of truth for runtime config shape.

Service-specific env vars validated in `src/config.ts`:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No (default: `"development"`) | `"development"` \| `"local"` \| `"test"` |
| `KAWAZ_PLUS_BUCKET` | Yes | S3 bucket name for kawaz-plus uploads (media, thumbnails, avatars) |
| `UPLOAD_PREFIX` | Yes | Key prefix for raw media uploads within kawaz-plus bucket |
| `THUMBNAIL_PREFIX` | Yes | Key prefix for thumbnails within kawaz-plus bucket |
| `AVATAR_PREFIX` | Yes | Key prefix for avatar images within kawaz-plus bucket |
| `VOD_STORAGE_BUCKET` | Yes | S3 bucket name for VOD content (manifests, segments, VTT) |
| `JWT_SECRET` | Yes | Secret for signing/verifying JWT tokens |
| `ADMIN_PROMOTION_SECRET` | Yes | Secret required in `x-admin-secret` header to promote a user to admin |

Additional env vars are consumed by the internal packages (`createServerConfig()`, `createMongoConfig()`, `createAmqpConfig()`, `createStorageConfig()`) — refer to each package's documentation for their required variables.

### AMQP Exchange/Topic Conventions

- Upload API publishes: exchange `upload`, topic `upload.media`
- Upload consumer publishes (video): exchange `convert`, topic defined in `src/background/upload/binding.ts`
- Progress consumer listens: exchange `progress`, topic `progress.media` (updates media `status` + `percentage` for all statuses; saves `metadata` only on `"completed"`)
