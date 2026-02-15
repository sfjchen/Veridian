# Production Deployment Runbook (veridian.fyi)

## Architecture

- **Frontends (Vercel)**: veridian.fyi (teachers), s.veridian.fyi (students)
- **Backends (Railway/Render)**: Must deploy separately — not on Supabase or Vercel
- **Supabase**: Auth, DB, storage only (no backend code)

Backends use Flask-Socket.IO and cannot run on Vercel serverless. Without deployed backends, the site shows UI but API calls (classrooms, assignments, analysis, chat) fail. Deploy to Railway or Render, or run `python run.py` / `python get_coords.py` locally for dev.

## Vercel Projects

| Project | Root Directory | Production URL (short) |
|---------|----------------|------------------------|
| veridian-teacher | teacher/frontend | https://veridian-teacher.vercel.app |
| veridian-student | student/frontend | https://veridian-student.vercel.app |

Custom domains veridian.fyi (teacher) and s.veridian.fyi (student) are added; configure CNAME at your registrar (Vercel Dashboard → Project → Domains).

### Deploy Frontends

```bash
cd teacher/frontend && vercel deploy --prod
cd student/frontend && vercel deploy --prod
```

### Vercel Env Vars (Project Settings)

**veridian-teacher:**
- EXPO_PUBLIC_API_URL=https://veridian-teach.onrender.com
- EXPO_PUBLIC_STUDENT_API_URL=https://veridian-fi00.onrender.com
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

**veridian-student:**
- EXPO_PUBLIC_BACKEND_URL=https://veridian-fi00.onrender.com
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY

### Custom Domain (veridian.fyi)

veridian.fyi and s.veridian.fyi are added. At your DNS registrar, add CNAME records (Vercel Dashboard → Project → Domains shows the exact target).

## Supabase Auth

1. Supabase Dashboard → Authentication → URL Configuration
2. Site URL: https://veridian.fyi (or https://veridian-teacher.vercel.app)
3. Redirect URLs: https://veridian.fyi/**, https://s.veridian.fyi/**, https://veridian-teacher.vercel.app/**, https://veridian-student.vercel.app/**

## Backend Deployment (Railway/Render)

### Teacher Backend

- Root: teacher/backend
- Build: `pip install -r requirements.txt`
- Start: `gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:${PORT:-5001} run:app`
- Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET, ANTHROPIC_API_KEY, FLASK_SECRET_KEY
- CORS_ALLOWED_ORIGINS: https://veridian.fyi,https://veridian-teacher.vercel.app,https://s.veridian.fyi,https://veridian-student.vercel.app

### Student Backend

- Root: student/backend
- Build: `pip install -r requirements.txt`
- Start: `gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:${PORT:-8000} get_coords:app`
- Env: All from student/backend/.env.example
- CORS_ALLOWED_ORIGINS: https://s.veridian.fyi,https://veridian-student.vercel.app,https://veridian.fyi
- WS_CORS_ORIGINS: https://s.veridian.fyi,https://veridian-student.vercel.app,https://veridian.fyi

After backends are live, set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_BACKEND_URL in Vercel.
