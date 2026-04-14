#!/bin/bash
set -e

IMAGE_NAME="kawaz-backend"
TAG="${1:-latest}"

docker build -t "$IMAGE_NAME:$TAG" .
