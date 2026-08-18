# Analyse de Sécurité - Bottin Scolaire

**Date:** 2026-08-17  
**Criticité:** Plusieurs problèmes identifiés (de faible à élevé)

---

## Résumé Exécutif

L'application présente **7 vulnérabilités moyennes à élevées** et **8 faiblesses recommandées** à corriger avant un déploiement en production. La majorité des problèmes concernent la validation des entrées, la gestion des fichiers et la protection contre les attaques courantes.

---

## Vulnérabilités Critiques & Élevées

### 1. ⚠️ **CRITIQUE: NoSQL Injection (regex non échappée)**

**Localisation:** `backend/server.py:323`
```python
if search:
    query["child_name"] = {"$regex": search.strip(), "$options": "i"}
```

**Risque:** Un attaquant peut injecter des caractères regex spéciaux pour modifier la requête MongoDB.

**Exemple d'attaque:**
```
GET /api/entries?search=.*
GET /api/entries?search=^admin
```

**Correction:**
```python
import re as regex_module
if search:
    # Échapper les caractères spéciaux regex
    safe_search = regex_module.escape(search.strip())
    query["child_name"] = {"$regex": safe_search, "$options": "i"}
```

**Gravité:** 🔴 CRITIQUE

---

### 2. ⚠️ **ÉLEVÉ: Path Traversal potentiel en upload de fichiers**

**Localisation:** `backend/server.py:101-115` (fonction `put_object`)
```python
def put_object(path: str, data: bytes, content_type: str) -> dict:
    file_path = STORAGE_ROOT / path  # path provient directement de l'upload
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(data)
```

**Risque:** Un attaquant peut utiliser `../` pour écrire des fichiers en dehors du répertoire `/storage`.

**Correction:**
```python
def put_object(path: str, data: bytes, content_type: str) -> dict:
    # Nettoyer et valider le chemin
    safe_path = Path(path).name  # Garder seulement le nom du fichier
    if ".." in path or path.startswith("/"):
        raise ValueError("Path traversal detected")
    
    file_path = STORAGE_ROOT / safe_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(data)
```

**Gravité:** 🟠 ÉLEVÉ

---

### 3. ⚠️ **ÉLEVÉ: Pas de limite de taille de fichier uploadés**

**Localisations:** 
- `backend/server.py:569` (upload cover)
- `backend/server.py:420` (import CSV emails)
- `backend/server.py:497` (import bottin CSV)

**Risque:** Attaque DoS - un attaquant peut uploader des fichiers énormes pour faire crasher l'application ou consommer le stockage.

**Correction:**
```python
from fastapi import File, UploadFile

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

@api_router.post("/admin/cover")
async def upload_cover(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    content = await file.read()
    
    # Vérifier la taille
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)")
    
    # Vérifier le type MIME
    if file.content_type not in ("image/png", "image/jpeg", "image/jpg", "image/gif"):
        raise HTTPException(status_code=400, detail="Format non supporté. PNG, JPG, GIF uniquement.")
    
    # ... reste du code
```

**Gravité:** 🟠 ÉLEVÉ

---

## Vulnérabilités Moyennes

### 4. ⚠️ **MOYEN: Tokens JWT stockés en localStorage (XSS)**

**Localisation:** `frontend/src/context/AuthContext.js:33`, `frontend/src/lib/apiClient.js:10`
```javascript
localStorage.setItem("bottin_token", data.token);
```

**Risque:** Si un attaquant injecte du code JavaScript (XSS), il peut voler le token. Le localStorage est accessible via `document.localStorage`.

**Correction:** Utiliser des cookies **HttpOnly**, **Secure**, **SameSite=Strict**:

```python
# Backend - définir le cookie
from fastapi.responses import JSONResponse

response = JSONResponse({"user": serialize(user)})
response.set_cookie(
    key="access_token",
    value=token,
    httponly=True,           # ✅ Inaccessible au JavaScript
    secure=True,             # ✅ HTTPS seulement
    samesite="strict",       # ✅ Protection CSRF
    max_age=7*24*60*60       # 7 jours
)
return response
```

```javascript
// Frontend - lire depuis les cookies (automatiquement envoyés par axios)
// Supprimer localStorage
api.interceptors.request.use((config) => {
  // Les cookies sont envoyés automatiquement si credentials=include
  return config;
}, ...);
```

**Gravité:** 🟡 MOYEN

---

### 5. ⚠️ **MOYEN: Pas de rate limiting (brute force attacks)**

**Localisation:** `backend/server.py:192-208` (login)

**Risque:** Un attaquant peut faire des milliers de tentatives de login sans restriction.

**Correction:**
```bash
pip install slowapi
```

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@api_router.post("/auth/login")
@limiter.limit("5/minute")  # 5 tentatives par minute par IP
async def login(request: Request, data: LoginInput):
    # ... code existant
```

**Gravité:** 🟡 MOYEN

---

### 6. ⚠️ **MOYEN: Pas de validation stricte des ObjectIds**

**Localisation:** `backend/server.py` (plusieurs endpoints)
```python
async def update_class(class_id: str, ...):
    await db.classes.update_one({"_id": ObjectId(class_id)}, ...)  # Peut lever une exception
```

**Risque:** Une ObjectId invalide peut causer une exception non gérée.

**Correction:**
```python
from bson import ObjectId
from bson.errors import InvalidId

def validate_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID invalide")

@api_router.put("/classes/{class_id}")
async def update_class(class_id: str, data: ClassInput, admin: dict = Depends(require_admin)):
    obj_id = validate_object_id(class_id)  # ✅ Validation stricte
    doc = await db.classes.find_one({"_id": obj_id})
    # ...
```

**Gravité:** 🟡 MOYEN

---

### 7. ⚠️ **MOYEN: Pas de CSRF protection**

**Risque:** Une requête POST/DELETE malveillante depuis un autre site peut être exécutée au nom de l'utilisateur.

**Correction:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get('FRONTEND_URL', 'http://localhost:3001')],  # ✅ Spécifique, pas *
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

**Gravité:** 🟡 MOYEN

---

## Faiblesses Recommandées

### 8. ⚠️ **FAIBLE: Mot de passe minimum trop faible (4 caractères)**

**Localisation:** `backend/server.py:215`
```python
if len(data.new_password) < 4:
    raise HTTPException(...)
```

**Recommandation:** Minimum 8-12 caractères + complexité.

```python
import string

def validate_password_strength(password: str):
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Min 12 caractères requis")
    
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in string.punctuation for c in password)
    
    if not (has_upper and has_lower and has_digit):
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir majuscules, minuscules et chiffres")
```

**Gravité:** 🟢 FAIBLE

---

### 9. ⚠️ **FAIBLE: Pas de logging des tentatives d'accès échouées**

**Recommandation:** Logger les tentatives de connexion/authentification échouées pour détecter les attaques.

```python
import logging
logger = logging.getLogger(__name__)

@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    
    if not user:
        logger.warning(f"Login attempt with non-existent email: {email}")  # ✅ Log
        raise HTTPException(status_code=401, detail="...")
    
    if not verify_password(data.password, user["password_hash"]):
        logger.warning(f"Failed login attempt for: {email}")  # ✅ Log
        raise HTTPException(status_code=401, detail="...")
```

**Gravité:** 🟢 FAIBLE

---

### 10. ⚠️ **FAIBLE: JWT sans refresh token**

**Risque:** Le token est valide 7 jours. Si volé, l'attaquant a accès longtemps.

**Recommandation:** Implémenter un refresh token avec TTL court.

```python
@api_router.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        # Vérifier que c'est un refresh token, pas un access token
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalide")
        
        new_token = create_access_token(payload["sub"], payload["email"])
        return {"token": new_token}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh failed")
```

**Gravité:** 🟢 FAIBLE

---

### 11. ⚠️ **FAIBLE: CORS par défaut permissif**

**Localisation:** `backend/server.py:1095`
```python
allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),  # ✅ Défaut à '*'
```

**Recommandation:** Ne jamais utiliser `*` en production.

```env
# .env
CORS_ORIGINS=https://example.com,https://www.example.com
```

**Gravité:** 🟢 FAIBLE

---

### 12. ⚠️ **FAIBLE: Pas de HTTPS enforced**

**Recommandation:** Ajouter un middleware pour rediriger HTTP vers HTTPS en production.

```python
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.https import HTTPSMiddleware

if os.environ.get("ENVIRONMENT") == "production":
    app.add_middleware(HTTPSMiddleware)  # Force HTTPS
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[os.environ.get("ALLOWED_HOSTS", "example.com")]
    )
```

**Gravité:** 🟢 FAIBLE

---

### 13. ⚠️ **FAIBLE: Exposition de messages d'erreur détaillés**

**Localisation:** Partout où `HTTPException` retourne des détails.

**Risque:** Les messages détaillés peuvent révéler la structure interne.

**Correction:** Retourner des messages génériques en production.

```python
def get_error_detail(error: str, is_production: bool = True):
    if is_production:
        return "Une erreur s'est produite. Veuillez réessayer."
    return error
```

**Gravité:** 🟢 FAIBLE

---

### 14. ⚠️ **FAIBLE: Pas de validation des types MIME (CSV)**

**Localisation:** `backend/server.py:420, 497`

**Risque:** Un attaquant peut uploader un fichier exécutable en le renommant en `.csv`.

**Correction:**
```python
@api_router.post("/admin/import")
async def import_bottin_csv(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    if file.content_type not in ("text/csv", "application/csv", "text/plain"):
        raise HTTPException(status_code=400, detail="Fichier CSV requis")
    
    raw = await file.read()
    # ...
```

**Gravité:** 🟢 FAIBLE

---

### 15. ⚠️ **FAIBLE: Pas de Content-Security-Policy (CSP)**

**Recommandation:** Ajouter un header CSP au frontend.

```python
# Backend
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

**Gravité:** 🟢 FAIBLE

---

## Recommandations de Sécurité Immédiate

### 🔴 À faire AVANT la production:

1. **Corriger la NoSQL Injection** (regex échappée)
2. **Corriger le Path Traversal** (validation du chemin)
3. **Ajouter les limites de taille de fichier**
4. **Utiliser les cookies HttpOnly au lieu de localStorage**
5. **Ajouter le rate limiting**

### 🟡 À faire bientôt:

6. Validation stricte des ObjectIds
7. CORS restricif (pas de `*`)
8. Validation des types MIME
9. Logging des événements de sécurité
10. HTTPS enforced en production

### 🟢 À considérer:

11. Password complexity validation
12. Refresh tokens
13. CSP headers
14. Audit logging complet

---

## Fichier de Configuration de Sécurité Recommandé

Créer un fichier `.env.prod` pour la production:

```env
# Production Security Config
ENVIRONMENT=production
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/bottin?retryWrites=true&w=majority
DB_NAME=bottin
JWT_SECRET=<very-long-random-secret-min-32-chars>
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=<strong-password-min-12-chars>
CORS_ORIGINS=https://bottin.your-domain.com
FRONTEND_URL=https://bottin.your-domain.com
ALLOWED_HOSTS=bottin.your-domain.com,www.bottin.your-domain.com
SECURE_COOKIES=true
HTTPS_ONLY=true
```

---

## Checklist de Déploiement en Production

- [ ] NoSQL injection corrigée
- [ ] Path traversal corrigé
- [ ] Limites de fichier activées
- [ ] Rate limiting activé
- [ ] Cookies HttpOnly activés
- [ ] CORS restricif configuré
- [ ] HTTPS enforced
- [ ] Logs de sécurité activés
- [ ] Secrets chargés depuis un gestionnaire sécurisé (ex: Secrets Manager, Vault)
- [ ] MongoDB en production (cluster managed, authentication requise)
- [ ] Firewall configuré
- [ ] Backups configurés
- [ ] Monitoring & alertes activés
- [ ] Certificats SSL valides
- [ ] Headers de sécurité ajoutés (CSP, X-Frame-Options, etc.)

---

## Références de Sécurité

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
- MongoDB Security: https://docs.mongodb.com/manual/security/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

**Rapport complété le 2026-08-17**  
Merci de corriger ces vulnérabilités avant un déploiement en production.
