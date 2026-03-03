# kawaz-backend

Kawaz Plus media backend service.

## What it does

- Exposes a health endpoint (`GET /health`)
- Exposes media upload endpoint (`POST /media/upload`, `multipart/form-data`)
- Publishes upload jobs to AMQP (`upload` exchange, `upload.media` topic)
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

This service directly validates these variables:

- `NODE_ENV` (`development` | `local` | `test`, defaults to `development`)
- `UPLOAD_STORAGE_BUCKET` (target bucket for uploaded media)
- `UPLOAD_STORAGE_KEY_PREFIX` (prefix for uploaded object keys)

It also requires the environment variables expected by these shared clients:

- server config (`createServerConfig`)
- Mongo config (`createMongoConfig`)
- AMQP config (`createAmqpConfig`)
- storage config (`createStorageConfig`)

A typical local setup looks like:

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

## Running

Development:

```bash
npm run dev
```

Production-like local run:

```bash
npm run build
npm run start
```

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
