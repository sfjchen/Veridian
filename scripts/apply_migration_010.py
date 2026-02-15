#!/usr/bin/env python3
"""Apply migration 010 (config columns) using Supabase Python client."""
import sys
import os

# Add teacher backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "teacher", "backend"))

from supabase import create_client
from dotenv import load_dotenv

# Load teacher backend env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "teacher", "backend", ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read migration SQL
migration_path = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations", "20260214000010_add_config_columns.sql")
with open(migration_path) as f:
    sql = f.read()

# Execute each statement
statements = [s.strip() for s in sql.split(";") if s.strip()]

for stmt in statements:
    print(f"Executing: {stmt[:80]}...")
    try:
        # Use postgrest RPC to execute raw SQL
        result = client.rpc("exec_sql", {"query": stmt}).execute()
        print(f"  ✓ Success")
    except Exception as e:
        # Try direct execute via supabase-py's internal connection
        print(f"  ! RPC failed, trying direct execute...")
        # Supabase Python client doesn't support raw SQL execution easily
        # We need psql or the dashboard
        print(f"Error: {e}", file=sys.stderr)
        print("\nPlease apply migration using Supabase Dashboard SQL Editor:", file=sys.stderr)
        print(f"  1. Go to: {SUPABASE_URL}/project/_/sql", file=sys.stderr)
        print(f"  2. Paste SQL from: {migration_path}", file=sys.stderr)
        print(f"  3. Run query", file=sys.stderr)
        sys.exit(1)

print("\nMigration applied successfully!")
