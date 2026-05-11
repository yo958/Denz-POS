#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "Pulling latest from origin/main..."
git pull origin main

echo "Rebuilding and restarting Docker container..."
docker compose down
docker compose up --build -d

echo "Done. Container running on port 3001."
