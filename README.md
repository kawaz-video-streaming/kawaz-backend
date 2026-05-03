# kawaz-backend

Kawaz Plus media backend service.

## What it does

- Exposes a health endpoint (`GET /health`)
- Exposes auth endpoints (`POST /auth/signup`, `POST /auth/login`, `POST /auth/promote`, `GET /auth/google/login`, `GET /auth/google/callback`) — signup requires email and creates users in `"pending"` status awaiting admin approval; login blocked for non-approved users; JWT stored in HttpOnly cookie; Google OAuth follows the same admin-approval gate as regular signup
- Exposes admin endpoints (`GET /admin/pending`, `POST /admin/pending/:username/approve`, `POST /admin/pending/:username/deny`) — manage pending user registrations with email notifications
- Exposes user endpoints (`GET /user/me`, `POST /user/profile`, `PUT /user/profile`, `DELETE /user/profile/:name`, `GET /user/profiles`) — per-user profile management
- Exposes avatar endpoints (`GET /avatar`, `GET /avatar/:id`, `GET /avatar/:id/image`, `POST /avatar`, `DELETE /avatar/:id`) — avatar catalog; image streamed directly as JPEG with cache headers
- Exposes avatar category endpoints (`GET /avatar-category`, `GET /avatar-category/:categoryId`, `POST /avatar-category`, `DELETE /avatar-category/:categoryId`) — manage avatar categories stored in MongoDB; deletion blocked when avatars still reference a category
- Exposes media genre endpoints (`GET /mediaGenre`, `GET /mediaGenre/:genreId`, `POST /mediaGenre`, `DELETE /mediaGenre`) — manage the genre taxonomy used by media and collections; deletion blocked when genre is referenced by any media or collection
- Exposes media CRUD endpoints (`GET /media`, `GET /media/uploading`, `GET /media/:id`, `PUT /media/:id`, `DELETE /media/:id`) — served from MongoDB; `/uploading` returns all non-completed media
- Exposes presigned-URL based media upload endpoints (`POST /media/upload/initiate`, `POST /media/upload/complete`) — browser uploads directly to S3 using presigned PUT URLs, then calls complete to trigger processing
- Exposes media collection CRUD endpoints (`/media-collection`) — group media into nestable collections; thumbnail streamed directly
- Exposes MPEG-DASH streaming endpoints (`/media/stream/:id/output.mpd`, `*.m4s`, `*.vtt`, `thumbnails.jpg`) — all streamed directly from VOD storage with cache headers
- Persists media metadata and status in MongoDB
- Exposes OpenAPI docs at `GET /api-docs`

## Tech stack

- Node.js + TypeScript
- `@ido_kawaz/server-framework`
- `@ido_kawaz/mongo-client`
- `@ido_kawaz/amqp-client`
- `@ido_kawaz/storage-client`
- Multer
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)

## Prerequisites

- Node.js 20+
- MongoDB
- AMQP broker (for example RabbitMQ)
- S3-compatible object storage

## Installation

```bash
npm install
```

## Environment variables

This service validates all environment variables at startup using Zod schemas. Missing or invalid values cause startup failure with clear error messages.

**Required variables:**

- `KAWAZ_PLUS_BUCKET` - S3 bucket for all kawaz-plus assets (media, thumbnails, avatars)
- `UPLOAD_PREFIX` - Key prefix for raw uploaded media files within the bucket
- `THUMBNAIL_PREFIX` - Key prefix for thumbnail images within the bucket
- `AVATAR_PREFIX` - Key prefix for avatar images within the bucket
- `VOD_STORAGE_BUCKET` - S3 bucket for VOD content (manifests, segments, VTT files)
- `JWT_SECRET` - Secret key used to sign and verify JWT tokens
- `ADMIN_PROMOTION_SECRET` - Secret required in `x-admin-secret` header to promote a user to admin
- `GMAIL_USER` - Gmail address used as sender for Mailer (approval requests, approval/denial emails)
- `GMAIL_APP_PASSWORD` - Gmail app password for SMTP authentication in the Mailer service
- `APP_DOMAIN` - Public base URL of the app (e.g. `https://kawazplus.com`); used in OAuth redirect URIs and mailer links
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 client secret

**Optional variables:**

- `NODE_ENV` - `development` | `local` | `test` | `production` (defaults to `development`)

**Inherited from shared clients** (see Prerequisites for details):

- Server config via `createServerConfig()` - Port, TLS, etc.
- Mongo config via `createMongoConfig()` - Connection string
- AMQP config via `createAmqpConfig()` - Broker connection
- Storage config via `createStorageConfig()` - S3 credentials and endpoint

**Troubleshooting startup:**

If the app fails to start, verify:
1. All required variables (`KAWAZ_PLUS_BUCKET`, `UPLOAD_PREFIX`, `THUMBNAIL_PREFIX`, `AVATAR_PREFIX`, `VOD_STORAGE_BUCKET`, `JWT_SECRET`, `ADMIN_PROMOTION_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `APP_DOMAIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are set
2. Shared client environment variables are valid (MongoDB, AMQP, S3 credentials)
3. `NODE_ENV` is one of the supported values (`development`, `local`, `test`, `production`)
 
**Example local setup:**

```env
NODE_ENV=local
PORT=8080
SECURED=false

JWT_SECRET=your-local-secret
ADMIN_PROMOTION_SECRET=your-admin-secret

MONGO_CONNECTION_STRING=mongodb://localhost:27017/kawaz
AMQP_CONNECTION_STRING=amqp://localhost:5672

AWS_ENDPOINT=http://localhost:9000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_PART_SIZE=134217728
AWS_MAX_CONCURRENCY=4

KAWAZ_PLUS_BUCKET=kawaz-plus
UPLOAD_PREFIX=raw
THUMBNAIL_PREFIX=raw/thumbnails
AVATAR_PREFIX=avatars
VOD_STORAGE_BUCKET=kawaz-plus-vod

GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password

APP_DOMAIN=http://localhost:8080
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Scripts

- `npm run dev` - run with `ts-node-dev`
- `npm run build` - clean and compile
- `npm run build:watch` - compile in watch mode
- `npm run start` - run compiled app from `dist` with `.env`
- `npm run start:dev` - build, then start compiled app
- `npm test` - run unit tests with Jest
- `npm run clean` - remove `dist`
- `npm run clean:advanced` - remove `dist`, `node_modules`, and `package-lock.json`
- `npm run build:advanced` - clean, install, and compile

## CI/CD

This repository includes a GitHub Actions workflow that runs on every push and pull request to `master` and `dev` branches. The CI pipeline:

- Installs dependencies
- Runs tests with Jest
- Compiles TypeScript

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for configuration details.

## Running

Development:

```bash
npm run dev
```

For production-like setup, see [Deployment](#deployment) section.

## API

Base URL (local): `http://localhost:8080`

### `GET /health`

Returns `200 OK` if service is running.

### `POST /auth/signup`

- Content type: `application/json`
- Body: `{ "username": string (min 3), "password": string (min 12), "email": string }`
- Success response: `202 { "message": "signup finished. Your account is awaiting admin approval" }`
- Error responses: `400` (invalid body or missing email), `409` (username taken)
- Note: no JWT is issued; the account is in `"pending"` status until an admin approves it. An approval-request email is sent to the configured `GMAIL_USER`.

### `POST /auth/login`

- Content type: `application/json`
- Body: `{ "username": string, "password": string }`
- Success response: `200 { "message": "Login successful" }` + sets `kawaz-token` HttpOnly cookie (maxAge: 2 days)
- Error responses: `400` (invalid body), `401` (invalid credentials or account not yet approved / denied)

### `POST /auth/promote`

- Header: `x-admin-secret: <ADMIN_PROMOTION_SECRET>`
- Content type: `application/json`
- Body: `{ "username": string }`
- Success response: `200 { "message": "User \"<username>\" promoted to admin" }`
- Error responses: `400` (missing header/body), `401` (wrong secret), `404` (user not found)

### `GET /auth/google/login`

- Redirects the browser to Google's OAuth consent screen
- Success response: `302` redirect to `https://accounts.google.com/o/oauth2/v2/auth`

### `GET /auth/google/callback`

- Called by Google after the user authenticates; exchanges the `code` query param for user info
- If the account is **approved**: `200 { "message": "Login successful" }` + sets `kawaz-token` HttpOnly cookie
- If the user is **new or pending**: `202 { "message": "Signup finished. Your account is awaiting admin approval" }`
- Error responses: `400` (missing code), `401` (Google auth failed or account denied), `409` (Google display name already taken as a username — sign up manually instead)
- Note: new Google users have a random placeholder password and cannot log in via `POST /auth/login`

### `GET /admin/pending`

- Requires: `kawaz-token` cookie with **admin role**
- Success response: `200 [{ "name": string, "email": string }]` — users with `status: "pending"`
- Error responses: `401`, `403`

### `POST /admin/pending/:username/approve`

- Requires: `kawaz-token` cookie with **admin role**
- Sets user status to `"approved"`; sends approval email to the user's registered email
- Success response: `200 { "message": "User approved" }`
- Error responses: `401`, `403`, `404` (user not found or not pending)

### `POST /admin/pending/:username/deny`

- Requires: `kawaz-token` cookie with **admin role**
- Sets user status to `"denied"`, sends denial email, then deletes the user record
- Success response: `200 { "message": "User denied" }`
- Error responses: `401`, `403`, `404` (user not found or not pending)

### `GET /user/me`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "username": string, "role": "user" | "admin" }`
- Error responses: `401` (missing or invalid token)

### `POST /user/profile`

- Requires: `kawaz-token` cookie with valid JWT
- Content type: `application/json`
- Body: `{ "profileName": string, "avatarId": string (ObjectId) }`
- Success response: `201 { "message": "Profile created successfully" }`
- Error responses: `400` (invalid body), `401`, `409` (profile name already exists for this user)

### `PUT /user/profile`

- Requires: `kawaz-token` cookie with valid JWT
- Content type: `application/json`
- Body: `{ "profileName": string, "avatarId": string (ObjectId) }`
- Success response: `200 { "message": "Profile avatar updated successfully" }`
- Error responses: `400` (invalid body), `401`, `404` (profile not found for this user)

### `DELETE /user/profile/:name`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "message": "Profile deleted successfully" }`
- Error responses: `401`

### `GET /user/profiles`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "profiles": [{ "name": string, "avatarId": string }] }`
- Error responses: `401`

### `GET /avatar`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 [{ "_id", "name", "categoryId" }]`
- Error responses: `401`, `404` (no avatars found)

### `GET /avatar/:id`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "_id", "name", "categoryId" }`
- Error responses: `401`, `404`

### `GET /avatar/:id/image`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` image/jpeg binary stream with `Cache-Control: public, max-age=172800`
- Error responses: `401`, `404`

### `POST /avatar`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `multipart/form-data`
- Fields: `name` (string), `categoryId` (string, ObjectId referencing an `AvatarCategory._id`), `avatar` (image file)
- Success response: `200 { "message": "Avatar created" }`
- Error responses: `400` (invalid body, non-image file, or category not found), `401`, `403`

### `DELETE /avatar/:id`

- Requires: `kawaz-token` cookie with **admin role**
- Deletes the avatar from the database and removes its image from storage
- Success response: `200 { "message": "Avatar deleted" }`
- Error responses: `400` (invalid id), `401`, `403`, `404`

### `GET /avatar-category`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 [{ "_id", "name" }]`
- Error responses: `401`

### `GET /avatar-category/:categoryId`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "_id", "name" }`
- Error responses: `400` (invalid id), `401`, `404`

### `POST /avatar-category`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `application/json`
- Body: `{ "name": string }`
- Success response: `201 { "message": "Avatar category created successfully" }`
- Error responses: `400` (missing or empty name), `401`, `403`, `409` (name already exists)

### `DELETE /avatar-category/:categoryId`

- Requires: `kawaz-token` cookie with **admin role**
- Deletion is blocked if any avatars still reference this category
- Success response: `200 { "message": "Avatar category deleted successfully" }`
- Error responses: `400` (invalid id or category has associated avatars), `401`, `403`

### `GET /mediaGenre`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 [{ "_id", "name" }]`
- Error responses: `401`

### `GET /mediaGenre/:genreId`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "_id", "name" }`
- Error responses: `400` (invalid id), `401`, `404`

### `POST /mediaGenre`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `application/json`
- Body: `{ "name": string }`
- Success response: `201 { "message": "Media genre created successfully" }`
- Error responses: `400` (missing or empty name), `401`, `403`, `409` (name already exists)

### `DELETE /mediaGenre`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `application/json`
- Body: `{ "name": string }` — genre to delete (identified by name)
- Deletion blocked if any media or collection references this genre name
- Success response: `200 { "message": "Media genre deleted successfully" }`
- Error responses: `400` (missing name or genre has associated media/collections), `401`, `403`

### `POST /media/upload/initiate`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `application/json`
- Body: `{ "title": string (required), "fileName": string (required), "fileSize": number (required), "mimeType": string (required, must start with `video/`), "description"?: string, "genres"?: string[], "thumbnailFocalPoint"?: { x, y }, "collectionId"?: string }`
- Success response: `200 { "mediaId": string, "videoUploadUrl": string, "thumbnailUploadUrl": string }` — presigned PUT URLs for direct browser-to-storage upload
- Error responses: `400` (missing/invalid fields or non-video mimetype), `401`, `403`
- Note: after calling this endpoint, the browser uploads the video file to `videoUploadUrl` and the thumbnail to `thumbnailUploadUrl` directly using HTTP `PUT`, then calls `/media/upload/complete`.

### `POST /media/upload/complete`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `application/json`
- Body: `{ "mediaId": string }`
- Success response: `200 { "message": "Media processing started" }`
- Error responses: `400` (missing mediaId), `401`, `403`, `404` (media not found or not in `pending` status)

### `GET /media`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 [{ "_id", "fileName", "title", "genres", "size", "status", "metadata", ... }]`
- Error responses: `401`, `404` (no media found)

### `GET /media/uploading`

- Requires: `kawaz-token` cookie with valid JWT
- Returns all media not yet in `completed` status (i.e. `pending`, `processing`, `failed`)
- Success response: `200 [{ "_id", "status", "percentage", ... }]`
- Error responses: `401`, `404` (no non-completed media found)

### `GET /media/:id/progress`

- Requires: `kawaz-token` cookie with valid JWT
- Returns the upload `percentage` (0–100) and current `status` for a specific media item
- If the media ID is not found, returns `{ status: "pending", percentage: 0 }` as a fallback
- Success response: `200 { "status": string, "percentage": number }`
- Error responses: `400` (invalid ID), `401`

### `GET /media/:id`

- Requires: `kawaz-token` cookie with valid JWT
- Only returns media in `completed` status
- Success response: `200 { "_id", "fileName", "title", "genres", "size", "status", "metadata", ... }`
- Error responses: `401`, `404` (media not found or not completed)

### `PUT /media/:id`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `multipart/form-data`
- Fields: `title` (required string), `description` (optional string, send `null` to clear), `genres` (optional string array, must reference existing MediaGenre names), `collectionId` (optional string, send `null` to remove from collection), `thumbnailFocalPoint` (optional `{ x, y }` to reposition crop anchor), `thumbnail` (optional image to replace the thumbnail)
- Success response: `200 { "message": "Media updated" }`
- Error responses: `400` (invalid id or body), `401`, `403`

### `DELETE /media/:id`

- Requires: `kawaz-token` cookie with **admin role**
- Success response: `200 { "message": "Media deleted" }`
- Error responses: `400` (invalid id), `401`, `403`

### `GET /media/:id/thumbnail`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` image/jpeg binary stream with `Cache-Control: public, max-age=172800`
- Error responses: `401`, `404`

### `POST /media-collection`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `multipart/form-data`
- Fields: `title` (required string), `description` (optional), `genres` (optional string array, must reference existing MediaGenre names), `thumbnailFocalPoint` (optional `{ x, y }`, defaults to `{ x: 0.5, y: 0.5 }`), `collectionId` (optional — parent collection for nesting), `thumbnail` (image, required)
- Success response: `200 { "message": "Media collection created" }`
- Error responses: `400` (invalid body or parent collection not found), `401`, `403`

### `GET /media-collection`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 [{ "_id", "title", "genres", "thumbnailFocalPoint", ... }]`
- Error responses: `401`, `404` (no collections found)

### `GET /media-collection/:id`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200 { "_id", "title", "genres", "thumbnailFocalPoint", ... }`
- Error responses: `401`, `404` (collection not found)

### `PUT /media-collection/:id`

- Requires: `kawaz-token` cookie with **admin role**
- Content type: `multipart/form-data`
- Fields: `title` (required string), `description` (optional string, send `null` to clear), `genres` (optional string array, must reference existing MediaGenre names), `collectionId` (optional string, send `null` to remove parent), `thumbnailFocalPoint` (optional `{ x, y }` to reposition crop anchor), `thumbnail` (optional image to replace the thumbnail)
- Success response: `200 { "message": "Media collection updated" }`
- Error responses: `400` (invalid id or body), `401`, `403`

### `DELETE /media-collection/:id`

- Requires: `kawaz-token` cookie with **admin role**
- Collection must be empty (no media or subcollections) or the request is rejected
- Success response: `200 { "message": "Media collection deleted" }`
- Error responses: `400` (invalid id), `401`, `403`, `500` (collection not empty)

### `GET /media-collection/:id/thumbnail`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` image/jpeg binary stream with `Cache-Control: public, max-age=172800`
- Error responses: `401`, `404`

### `GET /media/stream/:id/output.mpd`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` MPEG-DASH manifest (application/dash+xml)
- Error responses: `401`, `500`

### `GET /media/stream/:id/:filename.m4s`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` video/iso.segment binary stream with `Cache-Control: public, max-age=172800`
- Error responses: `401`, `500`

### `GET /media/stream/:id/:filename.vtt`

- Requires: `kawaz-token` cookie with valid JWT
- Success response: `200` VTT subtitle content (text/vtt)
- Error responses: `401`, `500`

### `GET /media/stream/:id/thumbnails.jpg`

- Requires: `kawaz-token` cookie with valid JWT
- Streams the sprite-sheet / tile thumbnails image for the video directly from VOD storage
- Success response: `200` image/jpeg binary stream with `Cache-Control: public, max-age=172800`
- Error responses: `401`, `500`

### `GET /api-docs`

Swagger UI for API documentation.

## Upload processing flow

1. Client calls `POST /media/upload/initiate` with JSON metadata (title, fileName, fileSize, mimeType).
2. API creates a media record in MongoDB (`pending` status) and returns presigned PUT URLs for the video and thumbnail.
3. Browser uploads the video file and thumbnail directly to S3 using the presigned PUT URLs.
4. Client calls `POST /media/upload/complete` with the `mediaId`.
5. API verifies the media is still in `pending` status, publishes a convert event to AMQP (`convert` / `convert.media`), and sets status to `processing` (percentage: 20).
6. Progress consumer (`progress` / `progress.media`) receives downstream events from the media processor and updates media status to `completed` or `failed`.

## Project structure

```
src/
├── api/          # REST API handlers and routes (media upload, health, swagger docs)
├── background/   # Background job consumers (AMQP listeners, upload processing)
├── dal/          # Data Access Layer (database models and queries)
├── services/     # Core business logic services (system initialization, db connection)
├── utils/        # Utility functions (file handling, Zod validation helpers, decorators)
├── config.ts     # Configuration management and validation
└── index.ts      # Application entry point
```

### Key modules:

- **api/auth** - Signup (pending status, email required), login, admin promotion
- **api/admin** - Admin panel: list/approve/deny pending users with email notifications
- **api/user** - User info (`/me`) and profile management (`/profile`, `/profiles`)
- **api/avatar** - Avatar catalog CRUD; image streamed directly with cache headers
- **api/avatarCategory** - Avatar category CRUD; deletion blocked when avatars reference the category
- **api/media** - Presigned-URL upload (initiate + complete), media CRUD, streaming
- **api/mediaCollection** - Media collection CRUD; thumbnail streamed directly
- **api/mediaGenre** - Genre CRUD; deletion guarded by genre usage in media and collections
- **background/upload** - AMQP upload consumer (currently disabled)
- **background/progress** - AMQP consumer for updating media status to `completed` or `failed`
- **dal/user** - User model (name, password, email, status, role) with embedded profiles
- **dal/avatar** - Avatar model and database operations; includes `isCategoryEmpty`
- **dal/avatarCategory** - AvatarCategory model and database operations
- **dal/media** - Media model and database operations; includes `getPendingMedia`, `isGenreEmpty`
- **dal/mediaCollection** - MediaCollection model and database operations; includes `isGenreUsedInCollection`
- **dal/mediaGenre** - MediaGenre model and database operations
- **services/mailer.ts** - Nodemailer-based Gmail SMTP service for user approval emails
- **services/system.ts** - Initializes API server, Mailer, and starts AMQP consumers

## Database schema

The service uses MongoDB with the following collection:

### `Media`

Stores metadata for uploaded media files.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String (ObjectId) | Yes | Unique identifier |
| `fileName` | String | Yes | Original filename |
| `title` | String | Yes | User-provided display title |
| `description` | String | No | Optional description |
| `genres` | String[] | Yes | Genre names referencing `MediaGenre.name` values |
| `size` | Number | Yes | File size in bytes |
| `status` | String | Yes | One of: `pending`, `processing`, `completed`, `failed` |
| `thumbnailFocalPoint` | Object `{ x, y }` | Yes | Crop anchor for the thumbnail (0–1 range, defaults to `{ x: 0.5, y: 0.5 }`) |
| `collectionId` | String | No | Parent collection ID |
| `metadata` | Object | No | Populated on completion (durationInMs, playUrl, thumbnailsUrl, streams, chapters, etc.) |

Example document:
```json
{
  "_id": "64a1f...",
  "fileName": "presentation.mp4",
  "title": "Q2 Highlights",
  "genres": ["Education"],
  "size": 52428800,
  "status": "completed",
  "thumbnailFocalPoint": { "x": 0.5, "y": 0.3 },
  "metadata": { "name": "presentation.mp4", "durationInMs": 120000, "playUrl": "..." }
}
```

### `MediaCollection`

Stores metadata for media collections (groups of media).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String (ObjectId) | Yes | Unique identifier |
| `title` | String | Yes | Display title |
| `description` | String | No | Optional description |
| `genres` | String[] | Yes | Genre names referencing `MediaGenre.name` values |
| `thumbnailFocalPoint` | Object `{ x, y }` | Yes | Crop anchor for the thumbnail (0–1 range, defaults to `{ x: 0.5, y: 0.5 }`) |
| `collectionId` | String | No | Parent collection ID (for nesting) |

### `User`

Stores user credentials and their profiles.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Unique username |
| `password` | String | Yes | Bcrypt-hashed password |
| `email` | String | Yes | Email address (provided at signup) |
| `status` | String | Yes | `pending` \| `approved` \| `denied` (defaults to `pending`) |
| `role` | String | Yes | `user` or `admin` (defaults to `user`) |
| `profiles` | Profile[] | Yes | List of user profiles (defaults to `[]`) |

Each `Profile` embedded document:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Profile display name (unique per user) |
| `avatarId` | String | Yes | Reference to an `Avatar._id` |

### `Avatar`

Stores avatar metadata. Avatar images are stored in object storage at `<AVATAR_PREFIX>/<_id>.jpg`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String (ObjectId) | Yes | Unique identifier |
| `name` | String | Yes | Avatar display name (e.g. `"David Ben-Gurion"`) |
| `categoryId` | String (ObjectId) | Yes | Reference to an `AvatarCategory._id` |

### `AvatarCategory`

Stores avatar category metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String (ObjectId) | Yes | Unique identifier |
| `name` | String | Yes | Category display name (unique) |

### `MediaGenre`

Stores the genre taxonomy. Media and collections reference genres by name (free-form string stored in the `genres` array field). Deletion is blocked if any media or collection still references the genre name.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String (ObjectId) | Yes | Unique identifier |
| `name` | String | Yes | Genre name (unique, e.g. `"Action"`, `"Comedy"`) |

## Error handling

The service uses custom error classes from `@ido_kawaz/server-framework`:

- `BadRequestError` - Invalid request data (400)
- `ValidationError` - Zod schema validation failures
- Configuration errors throw `InvalidConfigError` with detailed messages

All errors are logged with context and propagated to the HTTP response layer for proper status codes.

## Testing

Tests are colocated with source files in `__tests__` directories:

```
src/
├── api/media/__tests__/
│   ├── index.test.ts       # Handler and integration tests
│   ├── logic.test.ts       # Business logic tests
│   └── types.test.ts       # Type validation tests
├── api/avatar/__tests__/
│   ├── logic.test.ts       # Business logic tests
│   └── types.test.ts       # Type validation tests
├── api/avatarCategory/__tests__/
│   ├── logic.test.ts       # Business logic tests
│   └── types.test.ts       # Type validation tests
├── background/upload/__tests__/
│   ├── handler.test.ts     # Upload job handler tests (uploadMediaHandler + uploadSuccessHandler)
│   ├── index.test.ts       # Consumer setup tests
│   └── types.test.ts       # Type validation tests
├── background/progress/__tests__/
│   ├── handler.test.ts     # Progress handler tests
│   ├── index.test.ts       # Consumer setup tests
│   └── types.test.ts       # Type validation tests
└── __tests__/
    └── integration.test.ts # End-to-end integration tests
```

### Writing tests

Run tests with:
```bash
npm test
```

Tests use **Jest** with `--runInBand` (sequential execution for predictable shared state). Each test file should:

1. Import the module to test
2. Mock external dependencies (database, AMQP, storage)
3. Test happy paths and error cases
4. Clean up resources after each test

Example test structure:
```typescript
describe("mediaUploadHandler", () => {
  it("should handle valid file upload", async () => {
    // Arrange
    const mockReq = { file: { ... }, body: { ... } };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    // Act
    await mediaUploadHandler(mockReq, mockRes);
    
    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
```

## Background jobs (AMQP consumers)

The service runs AMQP consumers that process async jobs:

### Upload consumer

**Status: disabled** — browsers now upload directly to S3 via presigned PUT URLs. The upload consumer code remains in `src/background/upload/` but is not registered.

### Progress consumer

**Exchange:** `progress`
**Topic:** `progress.media`
**Handler:** `src/background/progress/handler.ts`

Receives downstream progress events and updates media status to `completed` or `failed` in MongoDB.

For environment configuration, see [Environment variables](#environment-variables) section.

## Deployment

### Production environment variables

Set `NODE_ENV=production`:

```env
NODE_ENV=production
PORT=3000
SECURED=true

MONGO_CONNECTION_STRING=mongodb://user:pass@mongo-host:27017/kawaz
AMQP_CONNECTION_STRING=amqp://user:pass@amqp-host:5672

AWS_ENDPOINT=https://s3.example.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-production-key
AWS_SECRET_ACCESS_KEY=your-production-secret
AWS_PART_SIZE=134217728
AWS_MAX_CONCURRENCY=4

KAWAZ_PLUS_BUCKET=kawaz-prod
UPLOAD_PREFIX=media
THUMBNAIL_PREFIX=media/thumbnails
AVATAR_PREFIX=avatars
VOD_STORAGE_BUCKET=kawaz-prod-vod

GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password

APP_DOMAIN=https://kawazplus.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Build and start

```bash
npm run build
npm run start
```

The service:
- Connects to MongoDB and verifies connection
- Connects to AMQP broker and starts consumers
- Starts HTTP server on `PORT`
- Logs startup messages to stdout
- Responds to health checks at `GET /health` (see [API](#api) section)
