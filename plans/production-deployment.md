# Production Deployment Runbook (veridian.fyi)

## Architecture

- **Frontends (Vercel)**: teacher.veridian.fyi, student.veridian.fyi
- **Backends (Railway/Render)**: api-teacher.veridian.fyi, api-student.veridian.fyi
- **Supabase**: Shared auth, DB, storage

Backends use Flask-Socket.IO and cannot run on Vercel serverless. Deploy to Railway or Render.

## Vercel Projects

| Project | Root Directory | Production URL |
|---------|----------------|----------------|
| veridian-teacher | teacher/frontend | https://veridian-teacher-*.vercel.app |
| veridian-student | student/frontend | https://veridian-student-*.vercel.app |

### Deploy Frontends

```bash
cd teacher/frontend && vercel deploy --prod
cd student/frontend && vercel deploy --prod
```

### Vercel Env Vars (Project Settings)

**veridian-teacher:**
- EXPO_PUBLIC_API_URL (production backend URL)
- EXPO_PUBLIC_STUDENT_API_URL
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

**veridian-student:**
- EXPO_PUBLIC_BACKEND_URL (production backend URL)
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

### Custom Domain (veridian.fyi)

1. Vercel Dashboard → Project → Settings → Domains
2. Add teacher.veridian.fyi, student.veridian.fyi
3. DNS: CNAME teacher.veridian.fyi → cname.vercel-dns.com (or Vercel-assigned)

## Supabase Auth

1. Supabase Dashboard → Authentication → URL Configuration
2. Site URL: https://teacher.veridian.fyi
3. Redirect URLs: https://teacher.veridian.fyi/**, https://student.veridian.fyi/**, https://veridian.fyi/**

## Backend Deployment (Railway/Render)

### Teacher Backend

- Root: teacher/backend
- Start: `python run.py` (or `flask run --host=0.0.0.0 --port=5001`)
- Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, ANTHROPIC_API_KEY, FLASK_SECRET_KEY
- CORS_ALLOWED_ORIGINS: https://teacher.veridian.fyi,https://student.veridian.fyi

### Student Backend

- Root: student/backend
- Start: `python get_coords.py`
- Env: All from student/backend/.env.example
- CORS_ALLOWED_ORIGINS: https://student.veridian.fyi,https://veridian.fyi
- WS_CORS_ORIGINS: https://student.veridian.fyi,https://veridian.fyi

After backends are live, set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_BACKEND_URL in Vercel.
