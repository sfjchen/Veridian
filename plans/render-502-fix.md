# Render — fix 502 Bad Gateway

If `curl https://veridian-student-backend.onrender.com/health` returns **502**, the web process is crashing on boot (not a missing API key — `/health` needs no keys).

## 1. Start command (required after our gunicorn fix)

Dashboard → **veridian-student-backend** → **Settings** → **Start Command**:

```bash
gunicorn --worker-class gthread --threads 8 --timeout 120 -w 1 -b 0.0.0.0:$PORT get_coords:app
```

**Do not use** `--worker-class eventlet` — flask-socketio uses `threading` mode and eventlet workers crash → 502.

Save, then **Manual Deploy**.

## 2. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENROUTER_API_KEY` | Yes | Mistake analysis, chat, OCR |
| `LLM_BACKEND` | Yes | `openrouter` |
| `MISTAKE_ANALYSIS_BACKEND` | Yes | `openrouter` |
| `CHAT_BACKEND` | Yes | `openrouter` |
| `MATH_OCR_BACKEND` | Yes | `openrouter` |
| `SUPABASE_URL` | Yes | `https://tpqasmpieyteutvdntda.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Dashboard → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Dashboard → API |
| `SUPABASE_JWT_SECRET` | Yes | Dashboard → JWT Settings |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://www.veridian.fyi,https://veridian-student.vercel.app` |
| `WS_CORS_ORIGINS` | Yes | same as CORS |

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are **optional** when everything uses OpenRouter.

## 3. Verify

```bash
curl https://veridian-student-backend.onrender.com/health
# {"status":"ok"}

cd /path/to/Veridian && ./scripts/smoke-whiteboard.sh --url https://www.veridian.fyi
```

## 4. Vercel (already wired)

Production env on **veridian-student**:

- `EXPO_PUBLIC_BACKEND_URL=https://veridian-student-backend.onrender.com`
- `EXPO_PUBLIC_SUPABASE_URL=https://tpqasmpieyteutvdntda.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = anon key

Live: https://www.veridian.fyi
