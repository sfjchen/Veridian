# Whiteboard Deployment (no local dev)

Deployment-only workflow for the **student whiteboard slice**: Expo web on Vercel + Flask on Render + Supabase `tpqasmpieyteutvdntda`.

## Stack

| Layer | Host | Path |
|-------|------|------|
| Canvas UI | Vercel | `student/frontend` — `npx expo export -p web` |
| AI backend | Render | `student/backend` — `get_coords.py` via gunicorn |
| DB + auth | Supabase | Project **Veridian** `tpqasmpieyteutvdntda` |

**Skip for whiteboard:** `teacher/` apps, local Expo Metro, local Flask.

## One-time setup

### 1. Supabase (done)

- Project: `tpqasmpieyteutvdntda` — [dashboard](https://supabase.com/dashboard/project/tpqasmpieyteutvdntda)
- **14 migrations** applied (teacher + student schema)
- Sample worksheets seeded (`high-school-algebra-01`)
- Details: `supabase/SUPABASE_JCHEN04.md`
- CLI: `supabase link --project-ref tpqasmpieyteutvdntda` (from repo root)

**Auth redirect URLs** (Dashboard → Authentication → URL Configuration):

- Site URL: `https://veridian-student.vercel.app`
- Redirect URLs: `https://veridian-student.vercel.app/**`, `https://*.vercel.app/**`

### 2. Render — student Flask backend

1. [Render Dashboard](https://dashboard.render.com/) → **New → Blueprint**
2. Connect repo `sfjchen/Veridian`, branch `main`
3. Uses root `render.yaml` → service `veridian-student-backend`
4. Set secrets in Render env:
   - `ANTHROPIC_API_KEY` (required)
   - `OPENAI_API_KEY` (optional; OCR paths)
   - `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
5. After deploy: `curl https://YOUR-SERVICE.onrender.com/health` → `{"status":"ok"}`

Start command (also in `Procfile`):

```bash
gunicorn --worker-class eventlet -w 1 --timeout 120 -b 0.0.0.0:$PORT get_coords:app
```

### 3. Vercel — student frontend

Project: **veridian-student** → https://veridian-student.vercel.app

Env vars (Project Settings → Environment Variables):

| Var | Value |
|-----|-------|
| `EXPO_PUBLIC_BACKEND_URL` | `https://YOUR-SERVICE.onrender.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://tpqasmpieyteutvdntda.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → API → anon |

Deploy:

```bash
./scripts/deploy-student-frontend.sh
```

Or push to `main` (GitHub → Vercel integration).

## Iteration loop

1. Edit `student/frontend/**` or `student/backend/**`
2. Push to `sfjchen/Veridian` `main`
3. Render auto-redeploys backend (if connected)
4. Vercel redeploys frontend (if GitHub linked) or run `./scripts/deploy-student-frontend.sh`
5. Smoke: open https://veridian-student.vercel.app → Sample Algebra → draw → Done → mistake dots

## Migrations (when schema changes)

- **Preferred:** Cursor Supabase MCP `apply_migration` with SQL from `supabase/migrations/` or `student/supabase/migrations/`
- **Alternative:** `SUPABASE_DB_URL=... ./scripts/apply_migrations.sh`
- **Do not apply** `student/supabase/migrations/202602140002_assignments_problems.sql` (conflicts with teacher schema)

## Required API keys (Render backend)

- `ANTHROPIC_API_KEY` — mistake analysis + chat
- `OPENAI_API_KEY` — optional math OCR (`MATH_OCR_*` in `.env.example`)

## Repo slice (whiteboard-only)

Keep: `student/`, `handwriting/`, `supabase/`, `scripts/`, `render.yaml`, `plans/`

Defer: `teacher/` (assignments still work via Supabase; demo uses sample worksheet without teacher app)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| UI loads, API fails | Set `EXPO_PUBLIC_BACKEND_URL` to live Render URL; redeploy Vercel |
| CORS error | Set `CORS_ALLOWED_ORIGINS` + `WS_CORS_ORIGINS` on Render to Vercel URL |
| Auth redirect loop | Add Vercel URL to Supabase redirect allowlist |
| `/health` 404 on old URL | Upstream `veridian-fi00.onrender.com` is stale — use your Render service |
