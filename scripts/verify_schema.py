#!/usr/bin/env python3
"""Verify database schema for config columns and corpus storage_path."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "teacher", "backend"))

from supabase import create_client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "teacher", "backend", ".env"))

client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

print("Checking schema...")

# Check classrooms table
try:
    result = client.table("classrooms").select("config").limit(1).execute()
    print("✓ classrooms.config column exists")
except Exception as e:
    print(f"✗ classrooms.config missing or error: {e}")

# Check assignments table
try:
    result = client.table("assignments").select("config").limit(1).execute()
    print("✓ assignments.config column exists")
except Exception as e:
    print(f"✗ assignments.config missing or error: {e}")

# Check corpus_files storage_path nullability (we can't check constraint directly via API)
try:
    result = client.table("corpus_files").select("storage_path").limit(1).execute()
    print(f"✓ corpus_files.storage_path exists (found {len(result.data)} records)")
    if result.data:
        has_null = any(r.get("storage_path") is None for r in result.data)
        print(f"  Current data has null storage_path: {has_null}")
except Exception as e:
    print(f"✗ corpus_files.storage_path error: {e}")
