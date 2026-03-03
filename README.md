# kawaz-backend

Kawaz Plus media backend service.

## What it does

- Exposes a health endpoint (`GET /health`)
- Exposes media upload endpoint (`POST /media/upload`, `multipart/form-data`)
- Publishes upload jobs to AMQP for async processing
- Consumes upload jobs and uploads files to object storage
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

- `UPLOAD_STORAGE_BUCKET` - Target bucket for uploaded media
- `UPLOAD_STORAGE_KEY_PREFIX` - Prefix for uploaded object keys

**Optional variables:**

- `NODE_ENV` - `development` | `local` | `test` (defaults to `development`)

**Inherited from shared clients** (see Prerequisites for details):

- Server config via `createServerConfig()` - Port, TLS, etc.
- Mongo config via `createMongoConfig()` - Connection string
- AMQP config via `createAmqpConfig()` - Broker connection
- Storage config via `createStorageConfig()` - S3 credentials and endpoint

**Troubleshooting startup:**

If the app fails to start, verify:
1. All required variables (`UPLOAD_STORAGE_BUCKET`, `UPLOAD_STORAGE_KEY_PREFIX`) are set
2. Shared client environment variables are valid (MongoDB, AMQP, S3 credentials)
3. `NODE_ENV` is one of the supported values

**Example local setup:**

```env
NODE_ENV=local
PORT=8080
SECURED=false

MONGO_CONNECTION_STRING=mongodb://localhost:27017/kawaz
AMQP_CONNECTION_STRING=amqp://localhost:5672

AWS_ENDPOINT=http://localhost:9000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_PART_SIZE=134217728
AWS_MAX_CONCURRENCY=4

UPLOAD_STORAGE_BUCKET=kawaz-plus
UPLOAD_STORAGE_KEY_PREFIX=raw
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

### `POST /media/upload`

- Content type: `multipart/form-data`
- Required file field: `file`
- Optional body field: `includeSubtitles` (boolean-like value)
- Success response: `200 { "message": "Media Started Uploading" }`

### `GET /api-docs`

Swagger UI for API documentation.

## Upload processing flow

1. API receives a file and stores initial media metadata in MongoDB (`pending` status).
2. API publishes an upload event to AMQP (`upload` / `upload.media`).
3. Upload consumer reads the temporary file and uploads it to object storage.
4. If media type is video, consumer publishes convert event (`converter` / `uploaded.media`) and sets status to `processing`.
5. If media type is image, consumer sets status to `completed`.

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

- **api/media** - Media upload handlers and request validation
- **background/upload** - AMQP consumer for processing upload jobs
- **dal/media** - Media model and database operations
- **services/system.ts** - Initializes API server and starts AMQP consumers

## Database schema

The service uses MongoDB with the following collection:

### `Media`

Stores metadata for uploaded media files.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Unique identifier |
| `name` | String | Yes | Original filename |
| `type` | String | Yes | MIME type (e.g., `video/mp4`, `image/jpeg`) |
| `size` | Number | Yes | File size in bytes |
| `status` | String | Yes | One of: `pending`, `processing`, `completed`, `failed` |
| `includesSubtitles` | Boolean | No | Whether video includes subtitle track |

Example document:
```json
{
  "_id": "ObjectId(...)",
  "name": "presentation.mp4",
  "type": "video/mp4",
  "size": 52428800,
  "status": "processing",
  "includesSubtitles": true
}
```

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
├── background/upload/__tests__/
│   ├── handler.test.ts     # Upload job handler tests
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

**Exchange:** `upload`  
**Topic:** `upload.media`  
**Handler:** `src/background/upload/handler.ts`

Triggered when API publishes upload events. Responsibilities:

1. Reads file from temporary storage
2. Uploads to S3-compatible storage
3. Detects media type (video/image)
4. Updates media status in MongoDB
5. Publishes downstream event to `converter` exchange (for videos)

For environment configuration, see [Environment variables](#environment-variables) section.

## Deployment

### Production environment variables

Set `NODE_ENV=development` (or omit for default):

```env
NODE_ENV=development
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

UPLOAD_STORAGE_BUCKET=kawaz-prod
UPLOAD_STORAGE_KEY_PREFIX=media
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
