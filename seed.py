"""Run during Render build to initialize DB schema and create admin user."""
import json
import db
import auth

db.init_db()
auth.ensure_admin()

INITIAL_PROJECTS = [
    {
        'title': 'NexEnroll',
        'subtitle': 'AI-Powered Academic Enrollment & Faculty Load Balancer',
        'description': (
            'Engineered an AI-driven enrollment engine using Gemini AI for automated credential '
            'validation, reducing manual registration time by 70% with 90% routing accuracy. '
            'Developed a secure, scalable architecture featuring RBAC, a dynamic faculty '
            'load-balancing algorithm, and a "System Guardrail" layer to guarantee 100% data '
            'consistency during high-concurrency grading periods.'
        ),
        'tech_stack': json.dumps(['Gemini AI', 'RBAC', 'FastAPI', 'React.js', 'PostgreSQL']),
        'live_url': 'https://ccissportal-frontend.vercel.app',
        'github_url': 'https://github.com/CodeForChange853/ccissportal-backend',
        'image': '/images/nexenroll.png',
        'order_index': 0,
        'visible': True,
        'type': 'web',
        'languages': json.dumps([
            {'name': 'React', 'pct': 45},
            {'name': 'Python', 'pct': 40},
            {'name': 'SQL', 'pct': 15},
        ]),
        'stats': json.dumps([
            ['70%', 'Faster Reg.'],
            ['90%', 'Accuracy'],
            ['100%', 'Consistency'],
            ['Live', 'Deployed'],
        ]),
    },
    {
        'title': 'Sto. Niño: NOBS',
        'subtitle': 'NAPOCOR Online Billing System',
        'description': (
            'Digitized documentation and payment workflows for underserved island communities, '
            'resolving long-standing dispute management issues. Integrated consumer dashboards '
            'and automated SMS reminders, reducing administrative bottlenecks and improving '
            'payment transparency.'
        ),
        'tech_stack': json.dumps(['React.js', 'FastAPI', 'PostgreSQL', 'SMS Integration']),
        'live_url': '',
        'github_url': 'https://github.com/CodeForChange853/NOBS',
        'image': '/images/nobs.png',
        'order_index': 1,
        'visible': True,
        'type': 'web',
        'languages': json.dumps([
            {'name': 'React', 'pct': 50},
            {'name': 'Python', 'pct': 35},
            {'name': 'SQL', 'pct': 15},
        ]),
        'stats': json.dumps([]),
    },
    {
        'title': 'Animind Duel',
        'subtitle': 'Android Trivia & Combat Game',
        'description': (
            'Developed a turn-based Android game using MVVM and StateFlow, combining trivia '
            'mechanics with Room (SQLite) for local data storage. Built custom VFX animations '
            'using Compose Canvas and integrated a GPU-accelerated background via OpenGL ES 2.0 '
            'to improve visual performance.'
        ),
        'tech_stack': json.dumps(['Kotlin', 'MVVM', 'Jetpack Compose', 'Room', 'OpenGL ES 2.0']),
        'live_url': '',
        'github_url': '',
        'image': '/images/animind.png',
        'order_index': 2,
        'visible': True,
        'type': 'app',
        'languages': json.dumps([
            {'name': 'Kotlin', 'pct': 80},
            {'name': 'Jetpack Compose', 'pct': 15},
            {'name': 'OpenGL ES', 'pct': 5},
        ]),
        'stats': json.dumps([]),
    },
]

conn = db.get_conn()
try:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM projects WHERE title='NexEnroll'")
        already_seeded = cur.fetchone()[0] > 0
    if not already_seeded:
        with conn.cursor() as cur:
            for p in INITIAL_PROJECTS:
                cur.execute(
                    """INSERT INTO projects
                           (title, subtitle, description, tech_stack, live_url, github_url,
                            image, order_index, visible, type, languages, stats)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (p['title'], p['subtitle'], p['description'], p['tech_stack'],
                     p['live_url'], p['github_url'], p['image'], p['order_index'],
                     p['visible'], p['type'], p['languages'], p['stats'])
                )
        conn.commit()
        print(f"Seeded {len(INITIAL_PROJECTS)} initial projects.")
    else:
        print("Initial projects already present — skipping.")
finally:
    conn.close()

print("Seed complete.")
