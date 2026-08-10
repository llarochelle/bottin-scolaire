# Bottin Scolaire

## Objectif

Ce dépôt contient une application React + FastAPI + MongoDB.
Le projet peut fonctionner en local avec Docker Compose, ou en mode Kubernetes local avec Kind.

## Utilisation avec Docker Compose

1. Créer un fichier `.env` à la racine avec les variables suivantes :

```env
MONGO_URL=mongodb://mongodb:27017
DB_NAME=bottin
JWT_SECRET=changeme
ADMIN_EMAIL=admin@test.ca
ADMIN_PASSWORD=admin123
CORS_ORIGINS=http://localhost:3001
```

2. Lancer les services :

```bash
docker compose up --build
```

3. Ouvrir l'interface :

- Frontend : `http://localhost:3001`

## Déploiement local avec Kind

Un déploiement Kind utilise les mêmes images Docker que le projet.
Les manifests Kubernetes sont dans `k8s/kind/`.

1. Créer un cluster Kind :

```bash
kind create cluster --name bottin
```

2. Déployer depuis le dossier `k8s/kind` :

```bash
cd k8s/kind
./kind-deploy.sh
```

3. Ouvrir l'interface :

- Frontend : `http://localhost:30001`

## Déploiement sur DigitalOcean Kubernetes

Le dossier `k8s/do/` contient des manifests et un script pour un déploiement DigitalOcean Kubernetes.

1. Connecter `kubectl` au cluster DigitalOcean.
2. Définir votre registre DigitalOcean :

```bash
export DO_REGISTRY=registry.digitalocean.com/<your-registry>
```

3. Définir les secrets :

```bash
export DO_MONGO_URL="mongodb://mongodb:27017"
export DO_JWT_SECRET="changeme"
export DO_ADMIN_EMAIL="admin@test.ca"
export DO_ADMIN_PASSWORD="admin123"
```

4. Déployer avec le script :

```bash
DO_REGISTRY=registry.digitalocean.com/<your-registry> \
DO_MONGO_URL="mongodb://mongodb:27017" \
DO_JWT_SECRET="changeme" \
DO_ADMIN_EMAIL="admin@test.ca" \
DO_ADMIN_PASSWORD="admin123" \
./k8s/do/do-deploy.sh
```

5. Vérifier l'IP du frontend :

```bash
kubectl get svc frontend -n bottin-scolaire
```

> Pour un déploiement plus sérieux, utilisez un cluster DigitalOcean avec un registre Docker, un MongoDB managé, et un Ingress TLS.

## Organisation

- `docker-compose.yml` : déploiement local Docker Compose
- `backend/` : API FastAPI
- `frontend/` : application React et Nginx
- `k8s/` : manifests et scripts Kind

## Remarques

- Le stockage MongoDB et `/storage` sont éphémères pour les tests locaux.
- Pour une installation de production, il faut ajouter un stockage persistant et un service MongoDB durable.

