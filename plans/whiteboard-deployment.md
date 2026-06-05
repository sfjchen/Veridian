# Whiteboard Deployment (no local dev)

Deployment-only workflow for the **student whiteboard slice**: Expo web on Vercel + Flask on Render + Supabase `tpqasmpieyteutvdntda`.

## Status checklist (2026-06-05)

| Step | Status | Notes |
|------|--------|-------|
| Supabase migrations + sample worksheets | **Done** | `veridian_sample_worksheets` has `high-school-algebra-01` |
| GitHub Actions deploy workflow | **Done** | Local Expo build + env injection + prebuilt Vercel deploy |
| GitHub secrets `VERCEL_*` | **Done** | On `sfjchen/Veridian` |
| GitHub var `EXPO_PUBLIC_BACKEND_URL` | **You set** | `https://veridian-student-backend.onrender.com` |
| GitHub secret `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **You set** | Jchen04 anon key |
| Render backend `/health` | **Blocked** | `veridian-student-backend.onrender.com` → **502** until Render secrets set |
| Vercel prod bundle env | **Blocked** | Still hackathon `daxwryjtzesdfjldvwsi` + `veridian-fi00` until next GHA deploy with vars |
| Supabase auth redirects | **You verify** | Add `https://www.veridian.fyi/**` if using custom domain |

**Smoke:** `./scripts/smoke-whiteboard.sh`

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

**Auth redirect URLs** (Dashboard → Authentication → URL Configuration):

- Site URL: `https://veridian-student.vercel.app` (or `https://www.veridian.fyi`)
- Redirect URLs:
  - `https://veridian-student.vercel.app/**`
  - `https://www.veridian.fyi/**`
  - `https://*.vercel.app/**`

### 2. Render — student Flask backend

1. [Render Dashboard](https://dashboard.render.com/) → **New → Blueprint**
2. Connect repo `sfjchen/Veridian`, branch `main`
3. Uses root `render.yaml` → service `veridian-student-backend`
4. **Required** secrets in Render env (app crashes at import without `ANTHROPIC_API_KEY`):
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET` (optional for student — JWKS fallback)
   - `OPENAI_API_KEY` (optional; OCR paths)
5. After deploy: `curl https://veridian-student-backend.onrender.com/health` → `{"status":"ok"}`

CORS in `render.yaml` allows `veridian-student.vercel.app` + `www.veridian.fyi` (+ `*.vercel.app` regex in code).

### 3. Vercel — student frontend

Project: **veridian-student** → https://veridian-student.vercel.app (alias **https://www.veridian.fyi**)

**GitHub Actions bakes `EXPO_PUBLIC_*` at build time** (do not rely on stale Vercel dashboard env).

Repository configuration on `sfjchen/Veridian`:

| Kind | Name | Value |
|------|------|-------|
| Variable | `EXPO_PUBLIC_SUPABASE_URL` | `https://tpqasmpieyteutvdntda.supabase.co` |
| Variable | `EXPO_PUBLIC_BACKEND_URL` | `https://veridian-student-backend.onrender.com` |
| Secret | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → API → anon |
| Secret | `VERCEL_TOKEN` | Vercel account token |
| Secret | `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| Secret | `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

Deploy:

```bash
./scripts/deploy-student-frontend.sh   # local CLI
# or push to sfjchen/Veridian main (GHA)
# or: gh workflow run deploy-student-frontend.yml --repo sfjchen/Veridian
```

<<<<<<< HEAD
Or push to `main` — **GitHub Actions** workflow `Deploy Student Frontend` (`.github/workflows/deploy-student-frontend.yml`) runs `vercel deploy --prod` on Vercel’s builders.

**GitHub repo secrets** (`sfjchen/Veridian` → Settings → Secrets and variables → Actions):

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

Workflow uses `actions/checkout@v6` and `actions/setup-node@v6` (Node.js 24 action runtime). App build on Vercel remains Node 22 via project settings.

=======
>>>>>>> c5d33fc (Harden whiteboard deploy: bake env in GHA, smoke checks, fix CORS.)
## Iteration loop

1. Edit `student/frontend/**` or `student/backend/**`
2. Push to `sfjchen/Veridian` `main`
3. Render auto-redeploys backend (if Blueprint connected)
4. GHA redeploys frontend with correct baked env
5. `./scripts/smoke-whiteboard.sh`
6. Manual: Sample Algebra → draw → Done → mistake dots

## Migrations (when schema changes)

- **Preferred:** Cursor Supabase MCP `apply_migration`
- **Alternative:** `SUPABASE_DB_URL=... ./scripts/apply_migrations.sh`
- **Do not apply** `student/supabase/migrations/202602140002_assignments_problems.sql`

## Required API keys (Render backend)

- `ANTHROPIC_API_KEY` — mistake analysis + chat (**required** — import fails without it)
- `OPENAI_API_KEY` — optional math OCR

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| GHA fails "Missing EXPO_PUBLIC_BACKEND_URL" | Add repo **variable** on `sfjchen/Veridian` |
| GHA fails bundle check (daxwryjtzesdfjldvwsi / fi00) | Set GHA vars/secrets above; re-run workflow |
| UI loads, API fails | `EXPO_PUBLIC_BACKEND_URL` → live Render URL; redeploy |
| Backend 502 | Set `ANTHROPIC_API_KEY` + Supabase keys on Render; check logs |
| CORS error on www.veridian.fyi | Update Render `CORS_ALLOWED_ORIGINS` (in `render.yaml`) |
| Auth redirect loop | Add `www.veridian.fyi/**` to Supabase auth URLs |
| `/health` 404 on fi00 | Stale URL — use `veridian-student-backend.onrender.com` |

## Stale URLs (do not use)

- `https://veridian-fi00.onrender.com` — dead upstream student backend
- `daxwryjtzesdfjldvwsi` — hackathon Supabase project
- `https://s.veridian.fyi` — DNS not configured
