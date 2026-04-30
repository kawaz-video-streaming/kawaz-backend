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

This is a **media backend service** with two main processing paths:

1. **HTTP API** (`src/api/`) — Handles auth (admin-approved signup), admin panel, media presigned-URL upload flow, avatar/media/collection CRUD, and MPEG-DASH streaming.
2. **AMQP Consumer** (`src/background/`) — One active consumer:
   - **Upload** (`src/background/upload/`) — **Currently disabled.** Browsers now upload directly to S3 via presigned PUT URLs returned by `/media/upload/initiate`.
   - **Progress** (`src/background/progress/`) — Listens for progress events, updates media `status` and `percentage` for any of the four statuses (`pending`, `processing`, `completed`, `failed`); saves video `metadata` only when status is `"completed"`.

### Request Flow

```
POST /media/upload/initiate  (JSON: title, fileName, fileSize, mimeType, kind, [description, episodeNumber, genres, thumbnailFocalPoint, collectionId])
  → Validate request (Zod) — requires title, fileName, fileSize, mimeType (video/*), kind ("movie"|"episode")
  → Validate parent-kind rules: episode must be in a season; movie may only be in a generic collection
  → Save media record to MongoDB (status: "pending", thumbnailFocalPoint stored)
  → storageClient.getPutPresignedUrl for video key (<uploadPrefix>/<fileName>)
  → storageClient.getPutPresignedUrl for thumbnail key (<thumbnailPrefix>/<mediaId>.jpg)
  → Return 200 { mediaId, videoUploadUrl, thumbnailUploadUrl }
  (browser then uploads directly to storage using the presigned PUT URLs)

POST /media/upload/complete  (JSON: { mediaId })
  → mediaDal.getPendingMedia(mediaId) — 404 if not found or not "pending"
  → Publish ConvertMessage to AMQP exchange "convert", topic "convert.media"
      (includes mediaId, mediaFileName, mediaStorageBucket, mediaRoutingKey)
  → mediaDal.updateMedia(mediaId, { status: "processing", percentage: 20 })
  → Return 200 { message: "Media processing started" }

Note: The upload AMQP consumer (src/background/upload/) is currently disabled.
      Browsers upload directly to storage via presigned URLs.
```

### HTTP Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | No | Register a new user (requires email); returns 202, account awaits admin approval |
| `POST` | `/auth/login` | No | Login; sets `kawaz-token` HttpOnly cookie (maxAge: 2 days). Blocked if status is `pending` or `denied` |
| `POST` | `/auth/promote` | No (x-admin-secret header) | Promote a user to admin role |
| `POST` | `/auth/forgot-password` | No | Request password reset; emails raw token if email is registered. Always returns 200 (no email enumeration) |
| `POST` | `/auth/reset-password` | No | Reset password using a valid reset token; token is SHA-256 hashed before DB lookup; clears reset request on success |
| `GET` | `/admin/pending` | Yes (admin only) | List users awaiting approval (`[{ name, email }]`) |
| `POST` | `/admin/pending/:username/approve` | Yes (admin only) | Approve a pending user; sends approval email |
| `POST` | `/admin/pending/:username/deny` | Yes (admin only) | Deny a pending user; sends denial email and removes user |
| `GET` | `/user/me` | Yes | Returns the authenticated user's info (`username`, `role`) |
| `POST` | `/user/profile` | Yes | Create a profile for the authenticated user |
| `PUT` | `/user/profile` | Yes | Update the avatar of an existing profile (matched by `profileName`) |
| `DELETE` | `/user/profile/:name` | Yes | Delete one of the authenticated user's profiles |
| `GET` | `/user/profiles` | Yes | List all profiles for the authenticated user |
| `GET` | `/avatar` | Yes | List all avatars |
| `GET` | `/avatar/:id` | Yes | Get a single avatar's metadata |
| `GET` | `/avatar/:id/image` | Yes | Stream avatar image as `image/jpeg` with `Cache-Control: public, max-age=172800` |
| `POST` | `/avatar` | Yes (admin only) | Create an avatar with image upload |
| `DELETE` | `/avatar/:id` | Yes (admin only) | Delete an avatar from DB and storage |
| `GET` | `/avatar-category` | Yes | List all avatar categories |
| `GET` | `/avatar-category/:categoryId` | Yes | Get a single avatar category |
| `POST` | `/avatar-category` | Yes (admin only) | Create a new avatar category |
| `DELETE` | `/avatar-category/:categoryId` | Yes (admin only) | Delete an avatar category (must be empty) |
| `GET` | `/mediaGenre` | Yes | List all media genres |
| `GET` | `/mediaGenre/:genreId` | Yes | Get a single media genre |
| `POST` | `/mediaGenre` | Yes (admin only) | Create a new media genre (name must be unique) |
| `DELETE` | `/mediaGenre` | Yes (admin only) | Delete a media genre by name (must not be referenced by media or collections) |
| `POST` | `/media/upload/initiate` | Yes (admin only) | Create media record; returns `{ mediaId, videoUploadUrl, thumbnailUploadUrl }` (presigned PUT URLs) |
| `POST` | `/media/upload/complete` | Yes (admin only) | Signal browser upload done; triggers convert AMQP message, sets status to `processing` |
| `GET` | `/media` | Yes | List all completed media from MongoDB |
| `GET` | `/media/uploading` | Yes | List all non-completed media (pending/processing/failed) |
| `GET` | `/media/:id` | Yes | Get a single media's metadata from MongoDB |
| `GET` | `/media/:id/progress` | Yes | Get upload progress `{ status, percentage }` for a media item |
| `PUT` | `/media/:id` | Yes (admin only) | Update media title, description, genres, thumbnail image, or thumbnail focal point |
| `DELETE` | `/media/:id` | Yes (admin only) | Delete media from DB and VOD storage |
| `GET` | `/media/:id/thumbnail` | Yes | Stream thumbnail as `image/jpeg` with `Cache-Control: public, max-age=172800` |
| `GET` | `/media/stream/:id/output.mpd` | Yes | Stream MPEG-DASH manifest from VOD storage bucket |
| `GET` | `/media/stream/:id/:filename.m4s` | Yes | Stream video segment as `video/iso.segment` with `Cache-Control: public, max-age=172800` |
| `GET` | `/media/stream/:id/:filename.vtt` | Yes | Stream VTT subtitle file from VOD storage bucket |
| `GET` | `/media/stream/:id/thumbnails.jpg` | Yes | Stream sprite-sheet tile thumbnails as `image/jpeg` with `Cache-Control: public, max-age=172800` |
| `POST` | `/media-collection` | Yes (admin only) | Create a collection with a required thumbnail |
| `GET` | `/media-collection` | Yes | List all media collections |
| `GET` | `/media-collection/:id` | Yes | Get a single collection's metadata |
| `PUT` | `/media-collection/:id` | Yes (admin only) | Update collection title, description, genres, thumbnail image, or thumbnail focal point |
| `DELETE` | `/media-collection/:id` | Yes (admin only) | Delete a collection (must be empty) |
| `GET` | `/media-collection/:id/thumbnail` | Yes | Stream thumbnail as `image/jpeg` with `Cache-Control: public, max-age=172800` |
| `GET` | `/health` | No | Health check — returns 200 OK |
| `GET` | `/api-docs` | No | Swagger UI (OpenAPI documentation) |

### Media Model (`src/dal/media/model.ts`)

```ts
interface Media {
  _id: string;
  fileName: string;              // original filename
  title: string;                 // user-provided display title
  description?: string;
  kind: "movie" | "episode";
  episodeNumber?: number;        // required when kind === "episode"
  genres: string[];              // references MediaGenre.name values
  size: number;                  // file size in bytes
  status: MediaStatus;           // "pending" | "processing" | "completed" | "failed"
  percentage: number;            // upload progress 0–100; set by upload/progress consumers
  thumbnailFocalPoint: Coordinates; // { x, y } crop anchor, defaults to { x: 0.5, y: 0.5 }
  collectionId?: string;         // episode must reference a season; movie may reference a collection
  metadata?: MediaMetadata;      // populated by progress consumer on completion; includes thumbnailsUrl
}
```

### MediaCollection Model (`src/dal/mediaCollection/model.ts`)

```ts
interface MediaCollection {
  _id: string;
  title: string;
  description?: string;
  kind: "show" | "season" | "collection";
  seasonNumber?: number;         // required when kind === "season"
  genres: string[];              // references MediaGenre.name values
  thumbnailFocalPoint: Coordinates;
  collectionId?: string;         // season must reference a show; show may reference a collection
}
```

Deletion is blocked if the collection still contains media or subcollections (`CollectionNotEmptyError`, now a 400).

**Parent-kind rules** (enforced in `api/mediaCollection/logic.ts` and `api/media/logic.ts`):
- `season` must have a `collectionId` pointing to a `show`
- `show` must not have a `collectionId` pointing to a `show` or `season`
- `episode` must have a `collectionId` pointing to a `season`
- `movie` must not have a `collectionId` pointing to a `season` or `show`

Thumbnail is uploaded to storage at key `<thumbnailPrefix>/<mediaId>.jpg` by the upload consumer. The `thumbnailFocalPoint` is stored in the DB and used downstream for cropping.

`MediaMetadata` contains name, durationInMs, playUrl, chaptersUrl, chapters, videoStreams, audioStreams, and subtitleStreams — populated when the progress consumer receives a completed event from the media processor.

### User Model (`src/dal/user/model.ts`)

```ts
interface User {
  name: string;               // unique username (unique index)
  password: string;           // bcrypt-hashed
  email: string;              // required at signup; unique index
  status: "pending" | "approved" | "denied";  // defaults to "pending"
  role: "user" | "admin";     // defaults to "user"
  profiles: Profile[];        // embedded, defaults to []
  passwordResetRequest?: {    // set by forgot-password; cleared on reset
    token: string;            // SHA-256 hash of the emailed raw token
    expiration: Date;         // 1 hour from creation
  };
}
```

Login is blocked unless `status === "approved"`. Admin approval sends an email via `Mailer`.
Password reset: `POST /auth/forgot-password` generates a `randomBytes(32)` token, stores its SHA-256 hash + 1-hour expiry, emails the raw token. `POST /auth/reset-password` re-hashes the submitted token and looks it up; on match, bcrypt-hashes the new password and `$unset`s `passwordResetRequest`.

### System Initialization (`src/services/system.ts`)

Wires everything together:
- `Mailer` (Gmail SMTP) for user approval/denial emails
- `StorageClient` (S3-compatible, shared between media API; upload consumer disabled)
- One `AmqpClient` instance for consuming (background); API publishes via same client
- MongoDB connection + DALs
- AMQP consumers (progress consumer only; upload consumer is currently disabled)
- HTTP server with routes

### Key Internal Packages

All `@ido_kawaz/*` packages are listed as **devDependencies** (resolved locally via npm workspaces or local paths).

| Package | Purpose |
|---|---|
| `@ido_kawaz/server-framework` | Express-based HTTP framework with decorators |
| `@ido_kawaz/mongo-client` | MongoDB/Mongoose wrapper with base `Dal` class |
| `@ido_kawaz/amqp-client` | RabbitMQ client (publish/consume) |
| `@ido_kawaz/storage-client` | S3-compatible storage client |

### Patterns

- **Factory functions** for all modules: `createMediaHandlers(deps)`, `createUploadConsumer(deps)`, etc.
- **Zod validation** at every boundary: HTTP requests (`validateMediaUploadRequest`), AMQP payloads (`validateUploadPayload`), and env config (`src/config.ts`). The `validateRequest(schema)` factory in `src/utils/zod.ts` parses the full `req` object (not `req.body`) — schemas must match the Express request shape (`{ body, files, params, ... }`).
- **Nullable update fields**: `description` and `collectionId` use `z.string().nullish()` — sending `null` triggers a MongoDB `$unset`, omitting the field leaves the DB value unchanged.
- **Shared types**: `BucketsConfig`, `Coordinates`, `UploadedFile`, `RequestWithIdParam` are defined in `src/utils/types.ts` and shared across modules. `MEDIA_TAGS`/`MediaTag` have been removed; genres are now free-form strings referencing `MediaGenre.name`.
- **BucketsConfig**: All storage bucket names and key prefixes are consolidated into a single `BucketsConfig` object (see `src/utils/types.ts`) passed down to media, mediaCollection, and upload consumer — no per-feature config interfaces for storage.
- **DAL pattern**: Each entity has a DAL class extending the framework's base `Dal`. Media: `createMedia(MediaInfo)`, `updateMedia()`, `deleteMedia()`, `getAllMedia()`, `getMedia()`, `getPendingMedia()`, `getMediaUploadProgress()`, `getAllNoneCompletedMedia()`, `isCollectionEmpty()`, `isGenreEmpty(genreName)`. MediaCollection: `createCollection()`, `updateCollection()`, `deleteCollection()`, `getAllCollections()`, `getCollection()`, `isCollectionEmpty()`, `isGenreUsedInCollection(genre)`. MediaGenre: `getAllGenres()`, `getGenre(genreId)`, `verifyGenreExists(name)`, `createGenre(name)`, `deleteGenre(name)`. User: `createUser(name, password, email)`, `findUser()`, `verifyUser()`, `verifyEmail()`, `approveUser()`, `denyUser()`, `removeUser()`, `getPendingUsers()`, `promoteToAdmin()`, `createPasswordResetRequestForUser(email, tokenHash)`, `findUserByPasswordResetToken(tokenHash)`, `resetUserPassword(name, newPasswordHash)`. Avatar: `createAvatar()`, `deleteAvatar()`, `getAllAvatars()`, `getAvatarById()`, `isCategoryEmpty(categoryId)`. AvatarCategory: `getAllCategories()`, `getCategory(categoryId)`, `createCategory(name)`, `deleteCategory(categoryId)`, `verifyCategoryExists(categoryId)`.
- **Colocated tests**: `__tests__/` directories next to the source they test.
- **Handler decorator** from server-framework wraps route handlers for logging and error propagation.

### Configuration

All env vars are validated at startup via Zod in `src/config.ts`. An `InvalidConfigError` is thrown with a descriptive message if any required var is missing or invalid. The `SystemConfig` interface is the single source of truth for runtime config shape.

Service-specific env vars validated in `src/config.ts`:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No (default: `"development"`) | `"development"` \| `"local"` \| `"test"` \| `"production"` |
| `KAWAZ_PLUS_BUCKET` | Yes | S3 bucket name for kawaz-plus uploads (media, thumbnails, avatars) |
| `UPLOAD_PREFIX` | Yes | Key prefix for raw media uploads within kawaz-plus bucket |
| `THUMBNAIL_PREFIX` | Yes | Key prefix for thumbnails within kawaz-plus bucket |
| `AVATAR_PREFIX` | Yes | Key prefix for avatar images within kawaz-plus bucket |
| `VOD_STORAGE_BUCKET` | Yes | S3 bucket name for VOD content (manifests, segments, VTT) |
| `JWT_SECRET` | Yes | Secret for signing/verifying JWT tokens |
| `ADMIN_PROMOTION_SECRET` | Yes | Secret required in `x-admin-secret` header to promote a user to admin |
| `GMAIL_USER` | Yes | Gmail address used as the Mailer sender/recipient for approval request emails |
| `GMAIL_APP_PASSWORD` | Yes | Gmail app password for SMTP authentication in the Mailer service |

Additional env vars are consumed by the internal packages (`createServerConfig()`, `createMongoConfig()`, `createAmqpConfig()`, `createStorageConfig()`) — refer to each package's documentation for their required variables.

### AMQP Exchange/Topic Conventions

- Upload API publishes: exchange `upload`, topic `upload.media`
- Upload consumer publishes (video): exchange `convert`, topic defined in `src/background/upload/binding.ts`
- Progress consumer listens: exchange `progress`, topic `progress.media` (updates media `status` + `percentage` for all statuses; saves `metadata` only on `"completed"`)
