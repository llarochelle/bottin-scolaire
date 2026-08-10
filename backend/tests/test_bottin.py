"""Bottin scolaire backend tests - covers auth, classes, entries, admin, cover, export."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bottin.ca"
ADMIN_PASSWORD = "admin123"
PARENT_EMAIL = f"test_parent_{uuid.uuid4().hex[:8]}@exemple.ca"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def parent_token(admin_headers):
    # Add allowed email
    r = requests.post(f"{API}/admin/allowed-emails", json={"emails": [PARENT_EMAIL]}, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"add allowed email: {r.status_code} {r.text}"
    # Now login as parent (auto-provision; password == email)
    r2 = requests.post(f"{API}/auth/login", json={"email": PARENT_EMAIL, "password": PARENT_EMAIL}, timeout=30)
    assert r2.status_code == 200, f"Parent auto-provision login failed: {r2.status_code} {r2.text}"
    body = r2.json()
    assert body["user"]["role"] == "parent"
    return body["token"]


@pytest.fixture(scope="module")
def parent_headers(parent_token):
    return {"Authorization": f"Bearer {parent_token}"}


@pytest.fixture(scope="module")
def created_class(admin_headers):
    payload = {"group_number": f"TST{uuid.uuid4().hex[:4]}", "teachers": "Mme Test"}
    r = requests.post(f"{API}/classes", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"create class: {r.status_code} {r.text}"
    data = r.json()
    assert data["group_number"] == payload["group_number"]
    assert "id" in data
    yield data
    # cleanup
    requests.delete(f"{API}/classes/{data['id']}", headers=admin_headers, timeout=30)


# ---------- auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_login_unauthorized_email(self):
        r = requests.post(f"{API}/auth/login", json={"email": "not_allowed_xyz@nope.ca", "password": "anything"}, timeout=30)
        assert r.status_code == 401

    def test_me_admin(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_parent_auto_provision(self, parent_token):
        assert isinstance(parent_token, str) and len(parent_token) > 10


# ---------- classes ----------
class TestClasses:
    def test_create_and_list(self, admin_headers, created_class):
        r = requests.get(f"{API}/classes", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert created_class["id"] in ids

    def test_update_class(self, admin_headers, created_class):
        new_teachers = "Mme Test Updated"
        r = requests.put(
            f"{API}/classes/{created_class['id']}",
            json={"group_number": created_class["group_number"], "teachers": new_teachers},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["teachers"] == new_teachers

    def test_parent_cannot_create_class(self, parent_headers):
        r = requests.post(f"{API}/classes", json={"group_number": "999", "teachers": "x"}, headers=parent_headers, timeout=30)
        assert r.status_code == 403


# ---------- entries ----------
class TestEntries:
    @pytest.fixture(scope="class")
    def created_entry(self, parent_headers, created_class):
        payload = {
            "class_id": created_class["id"],
            "child_name": f"TEST_Child_{uuid.uuid4().hex[:5]}",
            "parent1": {"name": "John Doe", "phone": "514-555-1234", "email": PARENT_EMAIL},
            "parent2": {"name": "Jane Doe", "phone": "514-555-5678", "email": "jane@exemple.ca"},
            "call_first": "parent2",
        }
        r = requests.post(f"{API}/entries", json=payload, headers=parent_headers, timeout=30)
        assert r.status_code == 200, f"create entry: {r.status_code} {r.text}"
        data = r.json()
        assert data["child_name"] == payload["child_name"]
        assert data["call_first"] == "parent2"
        assert data["owner_email"] == PARENT_EMAIL
        return data

    def test_create_entry_persists(self, parent_headers, created_entry):
        r = requests.get(f"{API}/entries", headers=parent_headers, timeout=30)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert created_entry["id"] in ids

    def test_entries_mine(self, parent_headers, created_entry):
        r = requests.get(f"{API}/entries/mine", headers=parent_headers, timeout=30)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert created_entry["id"] in ids

    def test_entries_search(self, parent_headers, created_entry):
        r = requests.get(f"{API}/entries", params={"search": created_entry["child_name"][:6]}, headers=parent_headers, timeout=30)
        assert r.status_code == 200
        assert any(e["id"] == created_entry["id"] for e in r.json())

    def test_entries_filter_by_class(self, parent_headers, created_entry, created_class):
        r = requests.get(f"{API}/entries", params={"class_id": created_class["id"]}, headers=parent_headers, timeout=30)
        assert r.status_code == 200
        assert all(e["class_id"] == created_class["id"] for e in r.json())

    def test_update_own_entry(self, parent_headers, created_entry):
        new_name = created_entry["child_name"] + "_upd"
        payload = {
            "class_id": created_entry["class_id"],
            "child_name": new_name,
            "parent1": created_entry["parent1"],
            "parent2": created_entry["parent2"],
            "call_first": "parent1",
        }
        r = requests.put(f"{API}/entries/{created_entry['id']}", json=payload, headers=parent_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["child_name"] == new_name

    def test_admin_can_edit_any_entry(self, admin_headers, created_entry):
        payload = {
            "class_id": created_entry["class_id"],
            "child_name": created_entry["child_name"] + "_admin",
            "parent1": created_entry["parent1"],
            "parent2": None,
            "call_first": "parent1",
        }
        r = requests.put(f"{API}/entries/{created_entry['id']}", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["parent2"] is None


# ---------- admin allowed emails ----------
class TestAllowedEmails:
    def test_list_emails(self, admin_headers):
        r = requests.get(f"{API}/admin/allowed-emails", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert any(e["email"] == PARENT_EMAIL for e in r.json())

    def test_parent_cannot_list_emails(self, parent_headers):
        r = requests.get(f"{API}/admin/allowed-emails", headers=parent_headers, timeout=30)
        assert r.status_code == 403

    def test_add_and_remove_email(self, admin_headers):
        e = f"chip_{uuid.uuid4().hex[:6]}@exemple.ca"
        r = requests.post(f"{API}/admin/allowed-emails", json={"emails": [e]}, headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["added"] == 1
        # remove
        r2 = requests.delete(f"{API}/admin/allowed-emails/{e}", headers=admin_headers, timeout=30)
        assert r2.status_code == 200


# ---------- admin users ----------
class TestUsers:
    def test_list_users(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        users = r.json()
        assert any(u["email"] == ADMIN_EMAIL for u in users)

    def test_promote_then_demote_parent(self, admin_headers, parent_token):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
        target = next(u for u in r.json() if u["email"] == PARENT_EMAIL)
        # promote
        r1 = requests.put(f"{API}/admin/users/{target['id']}/role", json={"role": "admin"}, headers=admin_headers, timeout=30)
        assert r1.status_code == 200
        assert r1.json()["role"] == "admin"
        # demote
        r2 = requests.put(f"{API}/admin/users/{target['id']}/role", json={"role": "parent"}, headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["role"] == "parent"

    def test_cannot_demote_main_admin(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=30)
        admin_user = next(u for u in r.json() if u["email"] == ADMIN_EMAIL)
        r2 = requests.put(f"{API}/admin/users/{admin_user['id']}/role", json={"role": "parent"}, headers=admin_headers, timeout=30)
        assert r2.status_code == 400


# ---------- cover & export ----------
class TestCoverExport:
    def test_upload_cover(self, admin_headers):
        # tiny 1x1 PNG
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000d49444154789c63f8cfc0f01f000005000100ff5c2c2f0000000049454e44ae426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/admin/cover", files=files, headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"cover upload: {r.status_code} {r.text}"

    def test_cover_public(self):
        r = requests.get(f"{API}/cover", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")

    def test_export_excel(self, admin_headers):
        r = requests.get(f"{API}/admin/export", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct, f"bad content-type: {ct}"
        assert len(r.content) > 100

    def test_export_excel_token_query(self, admin_token):
        """New: export must accept ?token=<jwt> for new-tab download."""
        r = requests.get(f"{API}/admin/export", params={"token": admin_token}, timeout=60)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct, f"bad content-type: {ct}"
        assert len(r.content) > 100
        # Verify it's a valid xlsx (PK zip header)
        assert r.content[:2] == b"PK", "Not a valid xlsx file"

    def test_export_excel_bad_token(self):
        r = requests.get(f"{API}/admin/export", params={"token": "not-a-valid-jwt"}, timeout=30)
        assert r.status_code == 401

    def test_export_excel_no_token(self):
        r = requests.get(f"{API}/admin/export", timeout=30)
        assert r.status_code == 401

    def test_export_excel_parent_token_forbidden(self, parent_token):
        """Parent token must get 403."""
        r = requests.get(f"{API}/admin/export", params={"token": parent_token}, timeout=30)
        assert r.status_code == 403, f"expected 403 for parent token, got {r.status_code} {r.text[:200]}"


# ---------- single email add with name (new feature) ----------
class TestSingleEmailAdd:
    def test_add_single_with_name(self, admin_headers):
        e = f"claire_{uuid.uuid4().hex[:6]}@exemple.ca"
        r = requests.post(
            f"{API}/admin/allowed-emails/single",
            json={"name": "Claire Test", "email": e},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code == 200, f"single add: {r.status_code} {r.text}"
        assert "ajout" in r.json().get("message", "").lower()
        # Verify list contains name + email
        r2 = requests.get(f"{API}/admin/allowed-emails", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        rec = next((x for x in r2.json() if x["email"] == e), None)
        assert rec is not None, "Newly added email not found in list"
        assert rec.get("name") == "Claire Test", f"Name mismatch: {rec}"
        # Cleanup
        requests.delete(f"{API}/admin/allowed-emails/{e}", headers=admin_headers, timeout=30)

    def test_add_single_invalid_email_returns_400(self, admin_headers):
        r = requests.post(
            f"{API}/admin/allowed-emails/single",
            json={"name": "Bad", "email": "pasbon"},
            headers=admin_headers, timeout=30,
        )
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code} {r.text}"

    def test_add_existing_email_updates_name(self, admin_headers):
        e = f"upd_{uuid.uuid4().hex[:6]}@exemple.ca"
        r1 = requests.post(f"{API}/admin/allowed-emails/single",
                           json={"name": "Old Name", "email": e},
                           headers=admin_headers, timeout=30)
        assert r1.status_code == 200
        # Re-add with new name -> should update
        r2 = requests.post(f"{API}/admin/allowed-emails/single",
                           json={"name": "New Name", "email": e},
                           headers=admin_headers, timeout=30)
        assert r2.status_code == 200, f"update name: {r2.status_code} {r2.text}"
        # Verify
        r3 = requests.get(f"{API}/admin/allowed-emails", headers=admin_headers, timeout=30)
        rec = next((x for x in r3.json() if x["email"] == e), None)
        assert rec is not None and rec.get("name") == "New Name", f"Name not updated: {rec}"
        # Cleanup
        requests.delete(f"{API}/admin/allowed-emails/{e}", headers=admin_headers, timeout=30)

    def test_purge_all_emails(self, admin_headers):
        # Add 2, purge, ensure all deleted (then re-add parent so other tests still pass)
        e1 = f"purge1_{uuid.uuid4().hex[:6]}@exemple.ca"
        e2 = f"purge2_{uuid.uuid4().hex[:6]}@exemple.ca"
        requests.post(f"{API}/admin/allowed-emails/single", json={"name": "A", "email": e1}, headers=admin_headers, timeout=30)
        requests.post(f"{API}/admin/allowed-emails/single", json={"name": "B", "email": e2}, headers=admin_headers, timeout=30)
        r = requests.delete(f"{API}/admin/allowed-emails", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert "deleted" in r.json()
        r2 = requests.get(f"{API}/admin/allowed-emails", headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json() == []
        # Restore parent email so subsequent tests still work
        requests.post(f"{API}/admin/allowed-emails", json={"emails": [PARENT_EMAIL]}, headers=admin_headers, timeout=30)


# ---------- change password ----------
class TestChangePassword:
    def test_change_and_relogin(self, admin_headers):
        # create temp user via allowed email + auto-provision
        email = f"pwd_{uuid.uuid4().hex[:6]}@exemple.ca"
        requests.post(f"{API}/admin/allowed-emails", json={"emails": [email]}, headers=admin_headers, timeout=30)
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": email}, timeout=30)
        assert r.status_code == 200
        tok = r.json()["token"]
        # change password
        new_pwd = "MyNewSecret123"
        r2 = requests.post(f"{API}/auth/change-password", json={"new_password": new_pwd}, headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r2.status_code == 200
        # relogin with new pwd
        r3 = requests.post(f"{API}/auth/login", json={"email": email, "password": new_pwd}, timeout=30)
        assert r3.status_code == 200


class TestImport:
    def test_admin_import_csv(self, admin_headers, created_class):
        # Prepare a small CSV to import one entry into the created class
        header = "group_number,child_name,parent1_name,parent1_phone,parent1_email\n"
        row = f"{created_class['group_number']},Import Child,Parent One,5140000000,parent1@example.com\n"
        csv_bytes = (header + row).encode("utf-8")
        files = {"file": ("bottin.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = requests.post(f"{API}/admin/import", files=files, headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"import failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("imported", 0) == 1

        # Verify the entry exists, then clean up
        r2 = requests.get(f"{API}/entries", params={"class_id": created_class['id']}, headers=admin_headers, timeout=30)
        assert r2.status_code == 200
        entries = r2.json()
        found = next((e for e in entries if e["child_name"] == "Import Child"), None)
        assert found is not None
        # cleanup
        requests.delete(f"{API}/entries/{found['id']}", headers=admin_headers, timeout=30)
