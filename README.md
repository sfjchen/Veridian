# Math Mistake Analysis Platform

EdTech platform for teachers to create math assignments and analyze student mistake patterns. Built with Flask + Expo React Native + Supabase.

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A [Supabase](https://supabase.com) project

## Quick run (from repo root)

After one-time setup, use the scripts in `scripts/`:

- **Teacher app:** `./scripts/setup-teacher.sh` once, then `./scripts/run-teacher.sh` (or run backend and frontend separately).
- **Student platform:** `./scripts/setup-student.sh` once, then `./scripts/run-student.sh`.

See `scripts/README.md` for all script options.

## Setup

### 1. Environment variables

Copy `.env.example` to both `backend/.env` and `frontend/.env`:

**backend/.env**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-key
FLASK_SECRET_KEY=any-random-string
SUPABASE_JWT_SECRET=your-jwt-secret
```

**frontend/.env**
```
# Optional in local dev; if omitted, the app auto-detects your Expo host and uses port 5000.
# On real devices, set this explicitly if auto-detection does not work.
# Example: EXPO_PUBLIC_API_URL=http://192.168.1.25:5000
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Database

Run the SQL in `supabase/all_migrations.sql` in your Supabase SQL Editor to create all tables, RLS policies, and storage buckets.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Server starts at `http://localhost:5000`.

### 4. Frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with Expo Go (mobile) or press `w` for web.

## Project Structure

```
backend/
  app/
    routes/          # Flask blueprints (assignments, classrooms, corpus, convert)
    services/        # Supabase client, storage helpers
    middleware/      # JWT auth
  run.py             # Entry point
frontend/
  src/
    screens/         # Teacher and student screens
    hooks/           # Data fetching hooks
    components/      # Shared components (FileUploader, LatexRenderer)
    stores/          # Auth context
    lib/             # API client, Supabase config
    navigation/      # React Navigation setup
supabase/
  migrations/        # Individual migration files
  all_migrations.sql # Combined migrations for fresh setup
```
