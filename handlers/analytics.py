import hashlib

import psycopg2.extras

import db
from utils import json_response

VALID_EVENTS = {'view', 'react', 'rate', 'share'}


def track(data, environ, start_response, headers):
    event_type = (data.get('event_type') or '').strip()
    if event_type not in VALID_EVENTS:
        return json_response(start_response, headers, {'error': 'Invalid event_type'}, 400)
    value = str(data.get('value', ''))
    ip = environ.get('HTTP_X_FORWARDED_FOR', environ.get('REMOTE_ADDR', ''))
    ip = ip.split(',')[0].strip()
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO analytics (event_type, value, ip_hash) VALUES (%s, %s, %s)",
                (event_type, value, ip_hash)
            )
        conn.commit()
        return json_response(start_response, headers, {'ok': True})
    finally:
        conn.close()


def stats(start_response, headers):
    conn = db.get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT event_type, COUNT(*) as count FROM analytics GROUP BY event_type"
            )
            counts = {r['event_type']: int(r['count']) for r in cur.fetchall()}

            cur.execute(
                """SELECT value, COUNT(*) as count FROM analytics
                   WHERE event_type='rate' GROUP BY value ORDER BY value::int"""
            )
            rating_dist = [{'value': r['value'], 'count': int(r['count'])} for r in cur.fetchall()]

            cur.execute(
                "SELECT COUNT(DISTINCT ip_hash) as u FROM analytics WHERE event_type='view'"
            )
            unique_views = int(cur.fetchone()['u'])

            cur.execute(
                """SELECT DATE(created_at) as day, COUNT(*) as count
                   FROM analytics WHERE event_type='view'
                   GROUP BY day ORDER BY day DESC LIMIT 7"""
            )
            daily_views = [{'day': str(r['day']), 'count': int(r['count'])} for r in cur.fetchall()]

        return json_response(start_response, headers, {
            'counts': counts,
            'rating_distribution': rating_dist,
            'unique_views': unique_views,
            'daily_views': daily_views,
        })
    finally:
        conn.close()
