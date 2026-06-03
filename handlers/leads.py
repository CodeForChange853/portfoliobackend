import psycopg2.extras

import db
from utils import json_response


def list_all(start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM leads ORDER BY created_at DESC")
            rows = cur.fetchall()
        result = []
        for row in rows:
            r = dict(row)
            r['created_at'] = r['created_at'].isoformat()
            result.append(r)
        return json_response(start_response, headers, result)
    finally:
        conn.close()


def create(data, start_response, headers):
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    message = (data.get('message') or '').strip()
    if not all([name, email, message]):
        return json_response(start_response, headers, {'error': 'name, email, message required'}, 400)
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO leads (name, email, message) VALUES (%s, %s, %s) RETURNING *",
                (name, email, message)
            )
            row = dict(cur.fetchone())
        conn.commit()
        row['created_at'] = row['created_at'].isoformat()
        return json_response(start_response, headers, row, 201)
    finally:
        conn.close()


def update(lead_id, data, start_response, headers):
    status = data.get('status')
    notes = data.get('notes')
    valid_statuses = {'new', 'contacted', 'closed'}
    if status and status not in valid_statuses:
        return json_response(start_response, headers, {'error': 'Invalid status'}, 400)
    if status is None and notes is None:
        return json_response(start_response, headers, {'error': 'Nothing to update'}, 400)
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if status is not None and notes is not None:
                cur.execute(
                    "UPDATE leads SET status=%s, notes=%s WHERE id=%s RETURNING *",
                    (status, notes, lead_id)
                )
            elif status is not None:
                cur.execute(
                    "UPDATE leads SET status=%s WHERE id=%s RETURNING *",
                    (status, lead_id)
                )
            else:
                cur.execute(
                    "UPDATE leads SET notes=%s WHERE id=%s RETURNING *",
                    (notes, lead_id)
                )
            row = cur.fetchone()
        conn.commit()
        if not row:
            return json_response(start_response, headers, {'error': 'Not found'}, 404)
        r = dict(row)
        r['created_at'] = r['created_at'].isoformat()
        return json_response(start_response, headers, r)
    finally:
        conn.close()


def delete(lead_id, start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM leads WHERE id=%s RETURNING id", (lead_id,))
            row = cur.fetchone()
        conn.commit()
        if not row:
            return json_response(start_response, headers, {'error': 'Not found'}, 404)
        return json_response(start_response, headers, {'deleted': lead_id})
    finally:
        conn.close()
