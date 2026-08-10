#!/bin/bash
set -euo pipefail

NAMESPACE=bottin-scolaire
CLUSTER_NAME=bottin

# Build local images
cd "$(dirname "$0")/.."

docker build -t bottin-backend:latest ./backend
docker build -t bottin-frontend:latest ./frontend

# Load images into kind cluster
kind load docker-image bottin-backend:latest --name "$CLUSTER_NAME"
kind load docker-image bottin-frontend:latest --name "$CLUSTER_NAME"

# Deploy manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for resources to be ready
kubectl wait --for=condition=available --timeout=120s deployment/backend -n "$NAMESPACE"
kubectl wait --for=condition=available --timeout=120s deployment/frontend -n "$NAMESPACE"

echo "Deployment complete. Frontend available on localhost:30001"
