# Veridian

AI-powered math tutoring pipeline. Full-stack application with Flask backend and React Native/Expo frontend.

## Architecture

```
Student writes on canvas (document or workspace)
  -> tap Done
  -> screenshot captured
  -> POST /analyze-solution
  -> OpenAI OCR (screenshot -> LaTeX; configurable via MATH_OCR_* env)
  -> Claude mistake analysis (annotated LaTeX)
  -> Claude vision coordinate detection (bounding boxes)
  -> mistake overlays appear on canvas
```

## Prerequisites

**Backend:**
- Python 3.10 or higher
- pip (Python package manager)

**Frontend:**
- Node.js (v18 or higher recommended)
- npm or yarn

## Setup

### Backend Setup

#### 1. Install Dependencies

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Environment Variables

Create a `.env` file in `backend/`:

```bash
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key
CLAUDE_MODEL=claude-3-5-sonnet-20241022
OPENAI_API_KEY=your_openai_api_key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional (defaults shown)
SUPABASE_SIGNED_URL_TTL_SECONDS=3600
SUPABASE_ARTIFACTS_TABLE=veridian_artifacts
SUPABASE_COORD_RUNS_TABLE=veridian_mistake_coord_runs

# Optional: math OCR speed vs quality (MATH_OCR_MODEL, MATH_OCR_IMAGE_DETAIL, MATH_OCR_MAX_IMAGE_SIDE)
# See .env.example; set MATH_OCR_DEBUG=1 to log handwriting recognition time to stderr.
```

#### 3. Supabase Setup

Apply the migration using Supabase CLI or dashboard:

```bash
student/supabase/migrations/202602140001_veridian_artifacts.sql   # artifacts + storage bucket
```

Ensure the `veridian-artifacts` storage bucket exists with proper RLS policies. See `SUPABASE_INTEGRATION.md` for details.

### Frontend Setup

#### 1. Install Dependencies

```bash
cd frontend/
npm install
```

#### 2. Environment Variables

Create a `.env` file in the `frontend/` directory:

```bash
# Backend API URL
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000

# For Android emulator, use:
# EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000
```

## Running the Application

### Backend Server

```bash
cd backend && python3 get_coords.py
```

The server starts on `http://0.0.0.0:8000` (accessible at `http://localhost:8000`).

#### Running in Production

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 get_coords:app
```

### Frontend App

```bash
cd frontend
npx expo start
```

In the output, you'll find options to open the app in a development build, Android emulator, iOS simulator, or Expo Go.

**Note:** Make sure the backend server is running before starting the frontend.

### Demo Flow (image-to-latex → mistake analysis → highlighting)

1. **Backend:** `python get_coords.py` (requires `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, Supabase vars)
2. **Frontend:** `cd frontend && npx expo start` (requires `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000` in `frontend/.env`). Run from `student/` directory.
3. **Document flow:** Open "Sample Algebra Problems" → work on problems with ink → tap **Done** → backend runs image-to-latex + MistakeAnalyzer → mistake boxes overlay on screen
4. **Workspace flow:** Tap **Workspace** in header → draw on whiteboard → tap **Done** → same analysis pipeline → mistake boxes overlay

## API Endpoints

### Analysis

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/analyze-solution` | No | Full pipeline: OCR + mistake analysis + coordinate detection |
| `POST` | `/mistake-coords` | No | Mistake bounding box detection from screenshot + annotated LaTeX |
| `POST` | `/mistake-coords/from-artifacts` | Yes | Same as above, but reads from Supabase artifacts |
| `POST` | `/image-to-latex` | No | Screenshot to LaTeX conversion (GPT-4o) |

### Artifacts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/artifacts/upload-url` | Yes | Get signed upload URL |
| `POST` | `/artifacts/confirm-upload` | Yes | Confirm upload completed |
| `POST` | `/artifacts/screenshot-to-latex` | Yes | Convert screenshot artifact to LaTeX artifact |
| `GET` | `/artifacts` | Yes | List user artifacts |
| `GET` | `/artifacts/<id>/download-url` | Yes | Get signed download URL |

### Other

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |

Auth = Supabase JWT Bearer token in `Authorization` header.

## Project Structure

- `get_coords.py` - Main Flask application
- `mistake_analysis/` - LLM-based mistake detection and annotation (Claude)
- `src/math_screenshot_to_latex/` - Math OCR: screenshot to LaTeX (OpenAI; MATH_OCR_* env for model/detail/size)
- `artifact_service.py` - Supabase artifact management
- `auth_middleware.py` - Authentication middleware
- `supabase_service.py` - Supabase client configuration
- `frontend/` - React Native/Expo app with document canvas, workspace whiteboard, and mistake overlays

## Development

See `AGENTS.md` and `CLAUDE.md` for development conventions and code review process.

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`. Update when features, architecture, or conventions change.

## Faster / cheaper

Most time and cost is in **mistake analysis** (Claude). To reduce both:

- **`MISTAKE_ANALYSIS_MODEL=claude-sonnet-4-5-20250929`** — Use Sonnet instead of Opus for analysis (faster and cheaper; may be slightly less accurate).
- **`MISTAKE_ANALYSIS_THINKING=0`** — Disable extended thinking when using Opus (lower latency and cost).

**Coords** use `CLAUDE_MODEL`; keep it on Sonnet (or a smaller model) if you want coords to stay cheap. **OCR** defaults to `gpt-4o-mini` and `low` detail; see `MATH_OCR_*` in `.env.example` to tune. To compare with OpenAI for mistake analysis, set `MISTAKE_ANALYSIS_BACKEND=openai` and optionally `MISTAKE_ANALYSIS_OPENAI_MODEL=gpt-4o` or `gpt-4o-mini`.

## Troubleshooting

**Backend:**
- **Missing environment variables**: Ensure all required variables are set in `.env`
- **Supabase connection errors**: Verify your Supabase credentials and that the migration has been applied
- **Port already in use**: Change the port in `get_coords.py` or set `PORT` environment variable
- **Import errors**: Ensure you're running from the project root and dependencies are installed

**Frontend:**
- **Cannot reach server**: Check that `EXPO_PUBLIC_BACKEND_URL` is set correctly in `frontend/.env` and the backend server is running
- **Android emulator connection**: Use `EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:8000` instead of `localhost`
- **Module not found**: Run `npm install` in the `frontend/` directory
- **Expo start errors**: Try clearing the cache with `npx expo start -c`

## Learn More

**Expo/React Native:**
- [Expo documentation](https://docs.expo.dev/)
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)
- [Expo on GitHub](https://github.com/expo/expo)
- [Discord community](https://chat.expo.dev)
