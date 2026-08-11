#!/usr/bin/env bash
# Build + push de la imagen del backend a ECR. Requiere Docker corriendo y
# AWS CLI configurado. Uso: ./push-image.sh [tag]
set -euo pipefail

TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TERRAFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REPO_URL="$(terraform -chdir="$TERRAFORM_DIR" output -raw ecr_repository_url)"
REGISTRY="${REPO_URL%%/*}"
# <account>.dkr.ecr.<region>.amazonaws.com — evita depender de un output
# aparte que puede no estar en el state si se hizo un apply con -target.
REGION="$(echo "$REGISTRY" | cut -d. -f4)"

echo "==> Repo: $REPO_URL"
echo "==> Tag:  $TAG"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

docker build -t "backend:$TAG" "$BACKEND_DIR"
docker tag "backend:$TAG" "$REPO_URL:$TAG"
docker push "$REPO_URL:$TAG"

echo "==> Listo: $REPO_URL:$TAG"
