from dotenv import load_dotenv
from pathlib import Path
import mimetypes
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Query, Header
from fastapi.responses import Response, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Annotated, Any
import uuid
import io
import csv
import re
import jwt
import bcrypt
import requests
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pydantic import BeforeValidator
from openpyxl import Workbook

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

STORAGE_ROOT = Path("/storage")
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- Auth helpers ----------------
JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton invalide")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur")
    return user


# ---------------- Object storage ----------------
APP_NAME = "bottin-scolaire"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    file_path = STORAGE_ROOT / path
    file_path.parent.mkdir(parents=True, exist_ok=True)

    file_path.write_bytes(data)

    return {
        "path": path,
        "storage_path": path,
    }


def get_object(path: str):
    file_path = STORAGE_ROOT / path

    if not file_path.exists():
        raise FileNotFoundError(path)

    content_type, _ = mimetypes.guess_type(str(file_path))

    return (
        file_path.read_bytes(),
        content_type or "application/octet-stream",
    )



# ---------------- Models ----------------
PyObjectId = Annotated[str, BeforeValidator(str)]


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordInput(BaseModel):
    new_password: str


class ClassInput(BaseModel):
    group_number: str
    teachers: str


class ParentContact(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""


class EntryInput(BaseModel):
    class_id: str
    child_name: str
    parent1: ParentContact
    parent2: Optional[ParentContact] = None
    call_first: str = "parent1"  # "parent1" | "parent2"


class AllowedEmailsInput(BaseModel):
    emails: List[str]


class SingleEmailInput(BaseModel):
    name: str = ""
    email: str


class RoleInput(BaseModel):
    role: str  # "admin" | "parent"


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


# ---------------- Auth endpoints ----------------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Auto-provision parent if email is authorized and password == email (default)
        allowed = await db.allowed_emails.find_one({"email": email})
        if not allowed:
            raise HTTPException(status_code=401, detail="Courriel non autorisé ou identifiants invalides")
        if data.password.lower().strip() != email:
            raise HTTPException(status_code=401, detail="Mot de passe invalide. Par défaut, votre mot de passe est votre courriel.")
        new_user = {
            "email": email,
            "password_hash": hash_password(data.password),
            "name": allowed.get("name", ""),
            "role": "parent",
            "password_changed": False,
            "pw_prompted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = await db.users.insert_one(new_user)
        new_user["_id"] = res.inserted_id
        user = new_user
    else:
        if not verify_password(data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Identifiants invalides")

    token = create_access_token(str(user["_id"]), email)
    return {"token": token, "user": serialize(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    user["id"] = user.pop("_id")
    return user


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordInput, user: dict = Depends(get_current_user)):
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 4 caractères")
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"password_hash": hash_password(data.new_password), "password_changed": True, "pw_prompted": True}},
    )
    return {"message": "Mot de passe mis à jour"}


@api_router.post("/auth/dismiss-password-prompt")
async def dismiss_password_prompt(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {"pw_prompted": True}},
    )
    return {"message": "ok"}


# ---------------- Classes ----------------
@api_router.get("/classes")
async def list_classes(user: dict = Depends(get_current_user)):
    classes = await db.classes.find().sort("group_number", 1).to_list(1000)
    return [serialize(c) for c in classes]


@api_router.post("/classes")
async def create_class(data: ClassInput, admin: dict = Depends(require_admin)):
    doc = {
        "group_number": data.group_number.strip(),
        "teachers": data.teachers.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.classes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.put("/classes/{class_id}")
async def update_class(class_id: str, data: ClassInput, admin: dict = Depends(require_admin)):
    await db.classes.update_one(
        {"_id": ObjectId(class_id)},
        {"$set": {"group_number": data.group_number.strip(), "teachers": data.teachers.strip()}},
    )
    doc = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    return serialize(doc)


@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, admin: dict = Depends(require_admin)):
    await db.classes.delete_one({"_id": ObjectId(class_id)})
    await db.entries.delete_many({"class_id": class_id})
    return {"message": "Classe supprimée"}


# ---------------- Entries ----------------
@api_router.get("/entries")
async def list_entries(user: dict = Depends(get_current_user), class_id: Optional[str] = None, search: Optional[str] = None):
    query: dict = {}
    if class_id:
        query["class_id"] = class_id
    if search:
        query["child_name"] = {"$regex": search.strip(), "$options": "i"}
    entries = await db.entries.find(query).sort("child_name", 1).to_list(5000)
    return [serialize(e) for e in entries]


@api_router.get("/entries/mine")
async def my_entries(user: dict = Depends(get_current_user)):
    entries = await db.entries.find({"owner_email": user["email"]}).sort("child_name", 1).to_list(1000)
    return [serialize(e) for e in entries]


@api_router.post("/entries")
async def create_entry(data: EntryInput, user: dict = Depends(get_current_user)):
    doc = {
        "class_id": data.class_id,
        "child_name": data.child_name.strip(),
        "parent1": data.parent1.model_dump(),
        "parent2": data.parent2.model_dump() if data.parent2 else None,
        "call_first": data.call_first,
        "owner_email": user["email"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.entries.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.put("/entries/{entry_id}")
async def update_entry(entry_id: str, data: EntryInput, user: dict = Depends(get_current_user)):
    entry = await db.entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Inscription introuvable")
    if user.get("role") != "admin" and entry.get("owner_email") != user["email"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres inscriptions")
    await db.entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {
            "class_id": data.class_id,
            "child_name": data.child_name.strip(),
            "parent1": data.parent1.model_dump(),
            "parent2": data.parent2.model_dump() if data.parent2 else None,
            "call_first": data.call_first,
        }},
    )
    doc = await db.entries.find_one({"_id": ObjectId(entry_id)})
    return serialize(doc)


@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    entry = await db.entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Inscription introuvable")
    if user.get("role") != "admin" and entry.get("owner_email") != user["email"]:
        raise HTTPException(status_code=403, detail="Action non autorisée")
    await db.entries.delete_one({"_id": ObjectId(entry_id)})
    return {"message": "Inscription supprimée"}


# ---------------- Admin: allowed emails ----------------
@api_router.get("/admin/allowed-emails")
async def get_allowed_emails(admin: dict = Depends(require_admin)):
    emails = await db.allowed_emails.find().sort("email", 1).to_list(5000)
    return [serialize(e) for e in emails]


@api_router.post("/admin/allowed-emails")
async def add_allowed_emails(data: AllowedEmailsInput, admin: dict = Depends(require_admin)):
    added = 0
    for raw in data.emails:
        email = raw.lower().strip()
        if not email or "@" not in email:
            continue
        existing = await db.allowed_emails.find_one({"email": email})
        if existing:
            continue
        await db.allowed_emails.insert_one({"email": email, "name": "", "created_at": datetime.now(timezone.utc).isoformat()})
        added += 1
    return {"added": added}


@api_router.post("/admin/allowed-emails/single")
async def add_single_allowed_email(data: SingleEmailInput, admin: dict = Depends(require_admin)):
    email = data.email.lower().strip()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Courriel invalide")
    name = data.name.strip()
    existing = await db.allowed_emails.find_one({"email": email})
    if existing:
        if name:
            await db.allowed_emails.update_one({"email": email}, {"$set": {"name": name}})
            return {"message": "Nom mis à jour"}
        raise HTTPException(status_code=400, detail="Ce courriel est déjà dans la liste")
    await db.allowed_emails.insert_one({"email": email, "name": name, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "Courriel ajouté"}


@api_router.post("/admin/allowed-emails/csv")
async def import_allowed_emails_csv(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    raw = (await file.read())
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    added = 0
    skipped = 0
    for line in text.splitlines():
        if not line.strip():
            continue
        cells = [c.strip().strip('"').strip() for c in re.split(r"[,;\t]", line) if c.strip()]
        email = ""
        name_parts = []
        for c in cells:
            if not email and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", c):
                email = c.lower()
            else:
                name_parts.append(c)
        name = " ".join(name_parts).strip()
        if not email:
            skipped += 1
            continue
        existing = await db.allowed_emails.find_one({"email": email})
        if existing:
            if name and not existing.get("name"):
                await db.allowed_emails.update_one({"email": email}, {"$set": {"name": name}})
            skipped += 1
            continue
        await db.allowed_emails.insert_one({"email": email, "name": name, "created_at": datetime.now(timezone.utc).isoformat()})
        added += 1
    return {"added": added, "skipped": skipped}


@api_router.post("/admin/import")
async def import_bottin_csv(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    """Import CSV of directory entries.

    Expected columns (case-insensitive):
      - class_id or group_number (preferred: group_number to match existing classes)
      - child_name
      - parent1_name, parent1_phone, parent1_email
      - parent2_name, parent2_phone, parent2_email (optional)
      - call_first (parent1|parent2) optional

    Rows are upserted by class + child_name.
    """
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    updated = 0
    errors = []
    for i, row in enumerate(reader, start=1):
        try:
            # normalize keys
            r = {k.strip().lower(): (v or "").strip() for k, v in row.items()}

            # determine class id: prefer explicit class_id (ObjectId) or lookup by group_number
            class_id = r.get("class_id") or r.get("class") or r.get("group_number") or r.get("group")
            if not class_id:
                raise ValueError("Missing class identifier (class_id or group_number)")

            # try to find class by group_number if not an ObjectId-like string
            target_class = None
            if re.fullmatch(r"[0-9a-fA-F]{24}", class_id):
                target_class = await db.classes.find_one({"_id": ObjectId(class_id)})
            if not target_class:
                # treat as group number
                target_class = await db.classes.find_one({"group_number": class_id})
            if not target_class:
                raise ValueError(f"Classe introuvable: {class_id}")

            child_name = r.get("child_name") or r.get("name") or r.get("child")
            if not child_name:
                raise ValueError("Missing child_name")

            p1 = {
                "name": r.get("parent1_name") or r.get("parent_name") or r.get("parent1") or "",
                "phone": r.get("parent1_phone") or r.get("parent_phone1") or r.get("parent_phone") or "",
                "email": (r.get("parent1_email") or r.get("parent_email1") or r.get("parent_email") or "").lower(),
            }
            p2 = {
                "name": r.get("parent2_name") or r.get("parent2") or "",
                "phone": r.get("parent2_phone") or "",
                "email": (r.get("parent2_email") or "").lower(),
            }
            call_first = (r.get("call_first") or "parent1").lower()
            if call_first not in ("parent1", "parent2"):
                call_first = "parent1"

            doc = {
                "class_id": str(target_class["_id"]),
                "child_name": child_name,
                "parent1": p1,
                "parent2": p2 if (p2["name"] or p2["phone"] or p2["email"]) else None,
                "call_first": call_first,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            res = await db.entries.update_one({"class_id": doc["class_id"], "child_name": doc["child_name"]}, {"$set": doc}, upsert=True)
            if res.matched_count:
                updated += 1
            else:
                imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"imported": imported, "updated": updated, "errors": errors}


@api_router.delete("/admin/allowed-emails")
async def purge_allowed_emails(admin: dict = Depends(require_admin)):
    res = await db.allowed_emails.delete_many({})
    return {"deleted": res.deleted_count}


@api_router.delete("/admin/allowed-emails/{email}")
async def remove_allowed_email(email: str, admin: dict = Depends(require_admin)):
    await db.allowed_emails.delete_one({"email": email.lower().strip()})
    return {"message": "Courriel retiré"}


# ---------------- Admin: users ----------------
@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("email", 1).to_list(5000)
    return [serialize(u) for u in users]


@api_router.put("/admin/users/{user_id}/role")
async def set_role(user_id: str, data: RoleInput, admin: dict = Depends(require_admin)):
    if data.role not in ("admin", "parent"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if target["email"] == os.environ.get("ADMIN_EMAIL", "").lower() and data.role != "admin":
        raise HTTPException(status_code=400, detail="Impossible de rétrograder l'administrateur principal")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": data.role}})
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize(doc)


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if target["email"] == os.environ.get("ADMIN_EMAIL", "").lower():
        raise HTTPException(status_code=400, detail="Impossible de supprimer l'administrateur principal")
    if str(target["_id"]) == admin["_id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "Utilisateur supprimé"}


@api_router.delete("/admin/users")
async def purge_users(admin: dict = Depends(require_admin)):
    main_admin = os.environ.get("ADMIN_EMAIL", "").lower()
    res = await db.users.delete_many({"email": {"$nin": [main_admin, admin["email"]]}})
    return {"deleted": res.deleted_count}


# ---------------- Cover image ----------------
@api_router.post("/admin/cover")
async def upload_cover(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    path = f"{APP_NAME}/cover/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "image/png")
    await db.settings.update_one(
        {"key": "cover"},
        {"$set": {
            "key": "cover",
            "storage_path": result["path"],
            "content_type": file.content_type or "image/png",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Image de couverture mise à jour"}


@api_router.get("/cover")
async def get_cover():
    setting = await db.settings.find_one({"key": "cover"})
    if not setting:
        raise HTTPException(status_code=404, detail="Aucune image de couverture")
    data, content_type = get_object(setting["storage_path"])
    return Response(content=data, media_type=setting.get("content_type", content_type), headers={"Cache-Control": "no-cache"})


@api_router.get("/cover/info")
async def cover_info(user: dict = Depends(get_current_user)):
    setting = await db.settings.find_one({"key": "cover"})
    return {"has_cover": setting is not None, "updated_at": setting.get("updated_at") if setting else None}


# ---------------- Excel export ----------------
@api_router.get("/admin/export")
async def export_excel(request: Request, token: Optional[str] = Query(None)):
    # Allow auth via query-param token (for opening in a new browser tab) or Authorization header
    jwt_token = token
    if not jwt_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            jwt_token = auth_header[7:]
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(jwt_token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton invalide")
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur")
    classes = await db.classes.find().sort("group_number", 1).to_list(1000)
    wb = Workbook()
    ws = wb.active
    ws.title = "Bottin"
    headers = [
        "Groupe", "Enseignant(e)", "Élève",
        "Parent 1 - Nom", "Parent 1 - Téléphone", "Parent 1 - Courriel",
        "Parent 2 - Nom", "Parent 2 - Téléphone", "Parent 2 - Courriel",
        "Appeler en premier",
    ]
    ws.append(headers)
    for c in classes:
        entries = await db.entries.find({"class_id": str(c["_id"])}).sort("child_name", 1).to_list(5000)
        for e in entries:
            p1 = e.get("parent1") or {}
            p2 = e.get("parent2") or {}
            call_first = "Parent 1" if e.get("call_first") == "parent1" else "Parent 2"
            ws.append([
                c.get("group_number", ""), c.get("teachers", ""), e.get("child_name", ""),
                p1.get("name", ""), p1.get("phone", ""), p1.get("email", ""),
                p2.get("name", ""), p2.get("phone", ""), p2.get("email", ""),
                call_first,
            ])
    for col in ws.columns:
        max_len = max((len(str(cell.value)) for cell in col if cell.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=bottin_scolaire.xlsx"},
    )


@api_router.get("/")
async def root():
    return {"message": "Bottin scolaire API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@bottin.ca").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrateur",
            "role": "admin",
            "password_changed": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
    try:
        await db.users.create_index("email", unique=True)
        await db.allowed_emails.create_index("email", unique=True)
    except Exception as e:
        logger.warning(f"index: {e}")

    logger.info("Local Storage initialized")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
