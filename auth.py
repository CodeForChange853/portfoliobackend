import hashlib
import os
import secrets

import psycopg2.extras

import db


def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(password, stored):
    try:
        salt, hashed = stored.split(':', 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
    except Exception:
        return False


def login(username, password):
    if not username or not password:
        return None
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM admin WHERE username = %s", (username,))
            admin = cur.fetchone()
        if not admin or not verify_password(password, admin['password_hash']):
            return None
        token = secrets.token_hex(32)
        with conn.cursor() as cur:
            cur.execute("UPDATE admin SET token = %s WHERE id = %s", (token, admin['id']))
        conn.commit()
        return token
    finally:
        conn.close()


def verify_token(token):
    if not token:
        return False
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM admin WHERE token = %s", (token,))
            return cur.fetchone() is not None
    finally:
        conn.close()


def logout(token):
    if not token:
        return
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE admin SET token = NULL WHERE token = %s", (token,))
        conn.commit()
    finally:
        conn.close()


def ensure_admin():
    username = os.environ.get('ADMIN_USERNAME', 'admin')
    password = os.environ.get('ADMIN_PASSWORD', '')
    if not password:
        print("WARNING: ADMIN_PASSWORD not set — admin user not created.")
        return
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM admin WHERE username = %s", (username,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO admin (username, password_hash) VALUES (%s, %s)",
                    (username, hash_password(password))
                )
                print(f"Admin user '{username}' created.")
            else:
                print(f"Admin user '{username}' already exists.")
        conn.commit()
    finally:
        conn.close()
