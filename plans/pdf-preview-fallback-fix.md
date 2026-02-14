# PDF Preview Fallback And Assignment Fetch Hardening

## Problem Summary

Users intermittently see "Assignment not found" after creating assignments/corpus files. The backend currently returns a hard `500` from assignment detail when signed download URL generation fails, and frontend PDF handling attempts to inspect file payloads in ways that can cascade into poor UX.

## Root Cause

1. `GET /assignments/<id>` fails the whole response when download URL generation errors.
2. Assignment screens aggressively fetch file contents to detect/render PDFs.
3. PDF files should be previewed safely rather than read as text payloads.

## Proposed Fix

1. Backend hardening:
- In assignment detail route, treat file URL generation failures as non-fatal and return assignment metadata with nullable file URLs.

2. PDF screenshot service:
- Add Python PDF rendering service using `PyMuPDF` to generate first-page PNG previews.
- Add authenticated endpoint `/convert/pdf-to-preview-image` that accepts PDF upload and returns base64 PNG payload.

3. Frontend integration:
- For assignment file previews, detect PDF by MIME/signature bytes.
- For PDFs, call backend preview endpoint and render returned image.
- Keep file download button; avoid treating PDF content as text.

## Files

- `teacher/backend/app/routes/assignments.py`
- `teacher/backend/app/routes/convert.py`
- `teacher/backend/app/services/pdf_preview.py` (new)
- `teacher/backend/requirements.txt`
- `teacher/frontend/src/lib/pdfPreview.ts` (new)
- `teacher/frontend/src/screens/teacher/AssignmentScreen.tsx`
- `teacher/frontend/src/screens/student/AssignmentScreen.tsx`

## Success Criteria

- Assignment detail no longer returns `500` solely because file download URL generation failed.
- PDF assignments render a screenshot preview (first page) in teacher/student assignment screens.
- Frontend no longer attempts to parse PDF bodies as assignment text.
