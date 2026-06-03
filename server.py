import json
import mimetypes
import os
import re
from pathlib import Path

import auth as auth_module
import db
from handlers import analytics as analytics_handler
from handlers import leads as leads_handler
from handlers import projects as projects_handler
from utils import json_response

STATIC_DIR = Path(__file__).parent / 'static' / 'dashboard'


def _cors_headers(environ):
    origin = environ.get('HTTP_ORIGIN', '')
    allowed = [o.strip() for o in os.environ.get('PORTFOLIO_ORIGIN', 'http://localhost:5173').split(',')]
    headers = [
        ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization'),
        ('Access-Control-Max-Age', '86400'),
    ]
    if origin in allowed:
        headers.append(('Access-Control-Allow-Origin', origin))
    return headers


def _read_body(environ):
    try:
        size = int(environ.get('CONTENT_LENGTH', 0) or 0)
    except (ValueError, TypeError):
        size = 0
    return environ['wsgi.input'].read(size) if size > 0 else b''


def _get_token(environ):
    auth_header = environ.get('HTTP_AUTHORIZATION', '')
    return auth_header[7:] if auth_header.startswith('Bearer ') else None


def _serve_static(path, start_response):
    rel = path.lstrip('/')
    file_path = STATIC_DIR / rel if rel else STATIC_DIR / 'index.html'
    if not file_path.exists() or not file_path.is_file():
        file_path = STATIC_DIR / 'index.html'
    mime, _ = mimetypes.guess_type(str(file_path))
    content = file_path.read_bytes()
    start_response('200 OK', [
        ('Content-Type', mime or 'application/octet-stream'),
        ('Content-Length', str(len(content))),
    ])
    return [content]


def app(environ, start_response):
    method = environ['REQUEST_METHOD']
    path = environ.get('PATH_INFO', '/')
    cors = _cors_headers(environ)

    if method == 'OPTIONS':
        start_response('204 No Content', cors)
        return [b'']

    body_bytes = _read_body(environ)

    def parse_body():
        return json.loads(body_bytes) if body_bytes else {}

    def is_authed():
        return auth_module.verify_token(_get_token(environ))

    # Route /api/resource or /api/resource/123
    id_match = re.match(r'^(/api/[^/]+)/(\d+)$', path)
    base = id_match.group(1) if id_match else path
    rid = int(id_match.group(2)) if id_match else None

    try:
        if not path.startswith('/api/'):
            return _serve_static(path, start_response)

        # --- Auth ---
        if path == '/api/auth/login' and method == 'POST':
            data = parse_body()
            token = auth_module.login(data.get('username'), data.get('password'))
            if token:
                return json_response(start_response, cors, {'token': token})
            return json_response(start_response, cors, {'error': 'Invalid credentials'}, 401)

        if path == '/api/auth/logout' and method == 'POST':
            auth_module.logout(_get_token(environ))
            return json_response(start_response, cors, {'ok': True})

        # --- Leads ---
        if base == '/api/leads':
            if method == 'POST' and not rid:
                return leads_handler.create(parse_body(), start_response, cors)
            if not is_authed():
                return json_response(start_response, cors, {'error': 'Unauthorized'}, 401)
            if method == 'GET':
                return leads_handler.list_all(start_response, cors)
            if method == 'PUT' and rid:
                return leads_handler.update(rid, parse_body(), start_response, cors)
            if method == 'DELETE' and rid:
                return leads_handler.delete(rid, start_response, cors)

        # --- Projects ---
        if base == '/api/projects':
            if method == 'GET' and not rid:
                return projects_handler.list_all(start_response, cors, show_all=is_authed())
            if not is_authed():
                return json_response(start_response, cors, {'error': 'Unauthorized'}, 401)
            if method == 'POST' and not rid:
                return projects_handler.create(parse_body(), start_response, cors)
            if method == 'PUT' and rid:
                return projects_handler.update(rid, parse_body(), start_response, cors)
            if method == 'DELETE' and rid:
                return projects_handler.delete(rid, start_response, cors)

        # --- Analytics ---
        if path == '/api/analytics/track' and method == 'POST':
            return analytics_handler.track(parse_body(), environ, start_response, cors)

        if path == '/api/analytics/stats' and method == 'GET':
            if not is_authed():
                return json_response(start_response, cors, {'error': 'Unauthorized'}, 401)
            return analytics_handler.stats(start_response, cors)

        return json_response(start_response, cors, {'error': 'Not found'}, 404)

    except json.JSONDecodeError:
        return json_response(start_response, cors, {'error': 'Invalid JSON'}, 400)
    except Exception as e:
        print(f"Server error: {e}")
        return json_response(start_response, cors, {'error': 'Internal server error'}, 500)


# Initialize DB and admin on startup
db.init_db()
auth_module.ensure_admin()
