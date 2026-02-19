# kawaz-backend

Kawaz Plus video streaming backend service

It provides:
- health check endpoint
- media upload endpoint (`multipart/form-data`)
- OpenAPI/Swagger UI docs
- MongoDB persistence for media metadata
- object storage upload via `@ido_kawaz/storage-client`

## Tech Stack

- Node.js + TypeScript
- Express
- Mongoose
- Multer
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)

## Prerequisites

- Node.js 20+ (required for `node --env-file` used by `npm run start`)
- MongoDB instance
- S3-compatible object storage endpoint

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=8080
SECURED=false

MONGO_CONNECTION_STRING=mongodb://localhost:27017/kawaz

AWS_ENDPOINT=http://localhost:9000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_PART_SIZE=134217728
AWS_MAX_CONCURRENCY=4
```

Notes:
- `SECURED` toggles `https.createServer` (`true`) vs `http.createServer` (`false`).
- `AWS_PART_SIZE` defaults to `134217728` (128 MiB) if not provided.
- `AWS_MAX_CONCURRENCY` defaults to `4` if not provided.

## Scripts

- `npm run dev` - run in development mode with `ts-node-dev`
- `npm run build` - clean `dist` and compile TypeScript
- `npm run build:watch` - compile in watch mode
- `npm run start` - run compiled app from `dist` using `.env`
- `npm run start:dev` - build then start compiled app
- `npm run clean` - remove `dist`
- `npm run clean:advanced` - remove `dist`, `node_modules`, and `package-lock.json`
- `npm run build:advanced` - advanced clean, fresh install, then build

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

## API Endpoints

Base URL (local): `http://localhost:8080`

- `GET /health`
	- returns `200 OK` when server is running

- `POST /media/upload`
	- content type: `multipart/form-data`
	- form field: `file`
	- response: `201 { "message": "Media uploaded successfully" }`

Swagger UI:

- `GET /api-docs`

## Upload Flow

1. File is received via Multer and written to `./tmp`.
2. File is uploaded to object storage bucket `kawaz-plus` under `raw/<originalname>`.
3. Metadata (`filename`, `contentType`, `size`, `uploadedAt`) is saved to MongoDB.
4. Temporary file is deleted from `./tmp`.