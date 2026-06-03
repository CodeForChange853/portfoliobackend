import json as jsonlib

import psycopg2.extras

import db
from utils import json_response


def list_all(start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM projects ORDER BY order_index ASC, id ASC")
            rows = [dict(r) for r in cur.fetchall()]
        return json_response(start_response, headers, rows)
    finally:
        conn.close()


def create(data, start_response, headers):
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    if not title or not description:
        return json_response(start_response, headers, {'error': 'title and description required'}, 400)
    tech_stack = jsonlib.dumps(data.get('tech_stack', []))
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """INSERT INTO projects
                       (title, description, tech_stack, live_url, github_url, image, order_index, visible)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING *""",
                (title, description, tech_stack,
                 data.get('live_url', ''), data.get('github_url', ''),
                 data.get('image', ''), data.get('order_index', 0),
                 data.get('visible', True))
            )
            row = dict(cur.fetchone())
        conn.commit()
        return json_response(start_response, headers, row, 201)
    finally:
        conn.close()


def update(project_id, data, start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM projects WHERE id=%s", (project_id,))
            existing = cur.fetchone()
        if not existing:
            return json_response(start_response, headers, {'error': 'Not found'}, 404)
        ex = dict(existing)
        title = data.get('title', ex['title'])
        description = data.get('description', ex['description'])
        tech_stack = jsonlib.dumps(data['tech_stack']) if 'tech_stack' in data else ex['tech_stack']
        live_url = data.get('live_url', ex['live_url'])
        github_url = data.get('github_url', ex['github_url'])
        image = data.get('image', ex['image'])
        order_index = data.get('order_index', ex['order_index'])
        visible = data.get('visible', ex['visible'])
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """UPDATE projects
                   SET title=%s, description=%s, tech_stack=%s,
                       live_url=%s, github_url=%s, image=%s,
                       order_index=%s, visible=%s
                   WHERE id=%s RETURNING *""",
                (title, description, tech_stack, live_url, github_url,
                 image, order_index, visible, project_id)
            )
            row = dict(cur.fetchone())
        conn.commit()
        return json_response(start_response, headers, row)
    finally:
        conn.close()


def delete(project_id, start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM projects WHERE id=%s RETURNING id", (project_id,))
            row = cur.fetchone()
        conn.commit()
        if not row:
            return json_response(start_response, headers, {'error': 'Not found'}, 404)
        return json_response(start_response, headers, {'deleted': project_id})
    finally:
        conn.close()
