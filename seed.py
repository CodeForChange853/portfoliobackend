"""Run during Render build to initialize DB schema and create admin user."""
import db
import auth

db.init_db()
auth.ensure_admin()
print("Seed complete.")
