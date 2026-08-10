# DigitalOcean Kubernetes Deployment

Ce dossier contient des manifests et des conseils pour déployer l'application sur un cluster Kubernetes DigitalOcean.

## Approche recommandée

- Utiliser un `Secret` pour les variables sensibles
- Utiliser un `ConfigMap` pour les variables non sensibles
- Déployer MongoDB dans le cluster seulement pour un usage de test ou POC
- Pour la production, utiliser une base de données MongoDB managée externe

## Public access

Le service frontend est exposé en interne avec un `Service` de type `ClusterIP`.
L'accès public peut être ajouté avec un `Ingress` TLS en définissant `DO_DOMAIN`.

## Usage

1. Connecter `kubectl` au cluster DigitalOcean.
2. Définir votre registre DigitalOcean :

```bash
export DO_REGISTRY=registry.digitalocean.com/<your-registry>
```

3. Créer le namespace :

```bash
kubectl apply -f k8s/do/namespace.yaml
```

4. Déployer les secrets et la configuration :

```bash
export DO_MONGO_URL="mongodb://mongodb:27017"
export DO_JWT_SECRET="changeme"
export DO_ADMIN_EMAIL="admin@test.ca"
export DO_ADMIN_PASSWORD="admin123"
kubectl apply -f k8s/do/backend-configmap.yaml
kubectl apply -f k8s/do/backend-secret.yaml
```

5. Déployer le stockage backend, MongoDB, le backend et le frontend :

```bash
kubectl apply -f k8s/do/backend-storage-pvc.yaml
kubectl apply -f k8s/do/mongodb-deployment.yaml
kubectl apply -f k8s/do/backend-deployment.yaml
kubectl apply -f k8s/do/frontend-deployment.yaml
```

6. Mettre à jour les images si vous avez un registre :

```bash
kubectl set image deployment/backend backend="$DO_REGISTRY/bottin-backend:latest" -n bottin-scolaire
kubectl set image deployment/frontend frontend="$DO_REGISTRY/bottin-frontend:latest" -n bottin-scolaire
```

### Déploiement via le script

Vous pouvez lancer :

```bash
DO_REGISTRY=registry.digitalocean.com/<your-registry> \
DO_MONGO_URL="mongodb://mongodb:27017" \
DO_JWT_SECRET="changeme" \
DO_ADMIN_EMAIL="admin@test.ca" \
DO_ADMIN_PASSWORD="admin123" \
DO_DOMAIN="example.com" \
./k8s/do/do-deploy.sh
```

Si `DO_DOMAIN` est défini, un `Ingress` TLS sera créé automatiquement pour le domaine indiqué.

### Notes

- `k8s/do/backend-secret.yaml` contient des valeurs d'exemple ; remplacez-les avant le déploiement.
- Le cluster DigitalOcean doit pouvoir accéder au registre Docker DigitalOcean.
- Pour un vrai déploiement de production, préférez une base MongoDB managée et un `Ingress` TLS.

## Remarque

- Sur DigitalOcean, préférer un service managé MongoDB si possible.
- Si le backend est exposé à l'extérieur, ajouter un `Ingress` et un certificat TLS.
