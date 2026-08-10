#!/bin/bash
set -euo pipefail

NAMESPACE=bottin-scolaire
DO_REGISTRY=${DO_REGISTRY:-}

if [[ -z "$DO_REGISTRY" ]]; then
  echo "Error: set DO_REGISTRY=registry.digitalocean.com/<your-registry>"
  exit 1
fi

cd "$(dirname "$0")/.."

BACKEND_IMAGE="${DO_REGISTRY}/bottin-backend:latest"
FRONTEND_IMAGE="${DO_REGISTRY}/bottin-frontend:latest"

docker build -t bottin-backend:latest ./backend
docker build -t bottin-frontend:latest ./frontend

docker tag bottin-backend:latest "$BACKEND_IMAGE"
docker tag bottin-frontend:latest "$FRONTEND_IMAGE"

docker push "$BACKEND_IMAGE"
docker push "$FRONTEND_IMAGE"

kubectl apply -f k8s/do/namespace.yaml

if [[ -n "${DO_MONGO_URL:-}" && -n "${DO_JWT_SECRET:-}" && -n "${DO_ADMIN_EMAIL:-}" && -n "${DO_ADMIN_PASSWORD:-}" ]]; then
  kubectl create secret generic backend-secrets -n "$NAMESPACE" \
    --from-literal=MONGO_URL="$DO_MONGO_URL" \
    --from-literal=JWT_SECRET="$DO_JWT_SECRET" \
    --from-literal=ADMIN_EMAIL="$DO_ADMIN_EMAIL" \
    --from-literal=ADMIN_PASSWORD="$DO_ADMIN_PASSWORD" \
    --dry-run=client -o yaml | kubectl apply -f -
else
  echo "Warning: DO_MONGO_URL, DO_JWT_SECRET, DO_ADMIN_EMAIL, DO_ADMIN_PASSWORD not all set. Using k8s/do/backend-secret.yaml as sample."
  kubectl apply -f k8s/do/backend-secret.yaml
fi

kubectl apply -f k8s/do/backend-configmap.yaml
kubectl apply -f k8s/do/backend-storage-pvc.yaml
kubectl apply -f k8s/do/backend-storage-pvc.yaml
kubectl apply -f k8s/do/mongodb-deployment.yaml
kubectl apply -f k8s/do/backend-deployment.yaml
kubectl apply -f k8s/do/frontend-deployment.yaml

kubectl set image deployment/backend backend="$BACKEND_IMAGE" -n "$NAMESPACE"
kubectl set image deployment/frontend frontend="$FRONTEND_IMAGE" -n "$NAMESPACE"

if [[ -n "${DO_DOMAIN:-}" ]]; then
  cat > /tmp/bottin-ingress.yaml <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: frontend-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt"
spec:
  tls:
    - hosts:
        - $DO_DOMAIN
      secretName: bottin-tls
  rules:
    - host: $DO_DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
EOF
  kubectl apply -f /tmp/bottin-ingress.yaml
fi

kubectl wait --for=condition=available --timeout=180s deployment/backend -n "$NAMESPACE"
kubectl wait --for=condition=available --timeout=180s deployment/frontend -n "$NAMESPACE"

echo "Deployment complete. Use kubectl get svc frontend -n $NAMESPACE to find the external IP."
