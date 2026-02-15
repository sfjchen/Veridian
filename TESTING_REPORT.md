# Fix Teacher Platform Errors - Testing Report

## ✅ Pre-Flight Verification Complete

### Database Schema
- ✅ `classrooms.config` column exists (migration 010 applied)
- ✅ `assignments.config` column exists (migration 010 applied)
- ✅ `corpus_files.storage_path` is nullable (migration 20260215000002 applied)

### Code Changes
- ✅ Python syntax valid: `teacher/backend/app/routes/corpus.py`
- ✅ TypeScript changes: `teacher/frontend/src/screens/teacher/CorpusUploadScreen.tsx`

### File Structure
```
✓ supabase/migrations/20260215000002_make_corpus_storage_path_nullable.sql
✓ teacher/backend/app/routes/corpus.py (modified)
✓ teacher/frontend/src/screens/teacher/CorpusUploadScreen.tsx (modified)
✓ scripts/apply_migrations.sh (updated with new migration)
✓ scripts/verify_schema.py (helper script)
```

---

## 🧪 Testing Plan

### TEACHER SIDE - Critical Tests

#### Test 1: Config Column Works (Assignment View)
**Purpose:** Verify migration 010 fixed the "column classrooms.config does not exist" error

**Steps:**
1. Start teacher backend: `cd teacher/backend && python run.py`
2. Start teacher frontend: `cd teacher/frontend && npm start`
3. Navigate to any classroom
4. Click on any assignment
5. Verify assignment details load without errors

**Expected Result:**
- ✅ No "column classrooms.config does not exist" error in console
- ✅ Assignment details page renders successfully
- ✅ `resolved_config` appears in API response (check Network tab)

**Failure Signs:**
- ❌ 500 error when fetching assignment
- ❌ "config does not exist" in backend logs

---

#### Test 2: New Corpus Upload (Happy Path)
**Purpose:** Verify corpus files upload correctly with conditional storage paths

**Steps:**
1. Navigate to a classroom
2. Go to Corpus tab
3. Click "Upload File"
4. Select a PDF file (e.g., `test.pdf`)
5. Enter display name: "Test Document"
6. Click "Upload File"
7. Wait for upload to complete

**Expected Result:**
- ✅ File uploads successfully
- ✅ File appears in corpus list
- ✅ Download URL is valid (not null)
- ✅ Can download the file
- ✅ Database record has `storage_path` set (not null)

**Verify in Database:**
```sql
SELECT id, display_name, storage_path FROM corpus_files
WHERE display_name = 'Test Document';
```
Should show: `storage_path` populated with path like `classroom-id/file-id.pdf`

---

#### Test 3: Existing Corpus Files (Backward Compatibility)
**Purpose:** Verify existing corpus files with storage_path still work

**Steps:**
1. Navigate to classroom with existing corpus files
2. View corpus list
3. Click download on an existing file
4. Try moving a file to a different folder

**Expected Result:**
- ✅ Existing files show with valid download URLs
- ✅ Can download existing files
- ✅ Can move existing files to different folders
- ✅ Can delete existing files

**Failure Signs:**
- ❌ Existing files show "File was not uploaded" error
- ❌ Download URLs are null
- ❌ Cannot move files

---

#### Test 4: Graceful Error Handling (Orphaned Records)
**Purpose:** Verify files with missing storage show graceful errors

**Steps:**
1. Check corpus list for any files that might have null storage_path
2. View file details

**Expected Result:**
- ✅ File metadata still renders
- ✅ `download_url` is `null`
- ✅ `download_url_error` shows: "File was not uploaded"
- ✅ No console errors or crashes
- ✅ Backend logs warning but doesn't crash

**Note:** If no orphaned records exist, this is expected behavior (good!)

---

#### Test 5: Folder Operations
**Purpose:** Verify folder path updates work correctly

**Steps:**
1. Create a new corpus file with folder path: `references/textbooks`
2. Upload the file
3. Update the file to move it to folder: `assignments/unit1`
4. Verify file moved in storage

**Expected Result:**
- ✅ File created with correct folder path
- ✅ Can update folder path
- ✅ Storage object moves to new path
- ✅ Database `storage_path` updates
- ✅ Download URL reflects new path

**Failure Signs:**
- ❌ Error: "Cannot move file that was never uploaded" (shouldn't happen for uploaded files)
- ❌ Storage object not moved
- ❌ 404 on download after move

---

#### Test 6: Delete File Cleanup
**Purpose:** Verify deletion cleans up storage correctly

**Steps:**
1. Upload a corpus file
2. Note the storage path from database
3. Delete the file
4. Check storage bucket

**Expected Result:**
- ✅ Database record deleted
- ✅ Storage object deleted
- ✅ No orphaned files in storage

**Failure Signs:**
- ❌ Database deleted but storage remains
- ❌ Error during deletion

---

### STUDENT SIDE - Impact Tests

#### Test 7: Assignment View (Student)
**Purpose:** Verify students can still view assignments correctly

**Steps:**
1. Start student backend: `cd student/backend && python get_coords.py`
2. Start student frontend: `cd student/frontend && npm start`
3. Login as a student
4. Navigate to Classes → select a class → Assignments
5. Click on an assignment
6. Verify assignment loads with correct config

**Expected Result:**
- ✅ Assignment loads successfully
- ✅ No "config does not exist" errors
- ✅ Assignment file (if any) displays correctly
- ✅ `resolved_config` is available for student runtime

**Failure Signs:**
- ❌ Assignment fails to load
- ❌ "Failed to fetch" errors
- ❌ Missing config data

---

#### Test 8: Context Files (Student Analysis)
**Purpose:** Verify students can access corpus files as context

**Steps:**
1. As a student, start a problem submission
2. If the assignment has context files (corpus), verify they're available
3. Check that context is passed to the analysis pipeline

**Expected Result:**
- ✅ Context files are accessible
- ✅ Analysis uses context correctly
- ✅ No errors fetching corpus files

**Note:** This depends on whether the assignment uses corpus files as context.

---

### REGRESSION TESTS

#### Test 9: Assignments Still Work (No Regression)
**Purpose:** Verify assignment file uploads weren't affected

**Steps:**
1. Create a new assignment with a PDF prompt
2. Upload the prompt file
3. Add an answer key PDF
4. Upload the answer key
5. View the assignment

**Expected Result:**
- ✅ Both files upload successfully
- ✅ Both files have download URLs
- ✅ Can view PDFs in assignment detail
- ✅ No "Failed to fetch" errors

**Failure Signs:**
- ❌ Assignment file upload fails
- ❌ Download URLs are null
- ❌ "Failed to fetch" errors return

---

## 🔍 Additional Verification

### Console Checks

**Teacher Backend Console - Should NOT see:**
- ❌ "column classrooms.config does not exist"
- ❌ "column assignments.config does not exist"
- ❌ "Failed to fetch" errors
- ❌ Unhandled exceptions in corpus routes

**Teacher Backend Console - OK to see:**
- ✅ "Failed to generate corpus download URL" (only for orphaned records)
- ✅ "DB deleted but storage cleanup failed" (rare, indicates storage issue)

### Browser DevTools Network Tab

**Check API Responses:**

1. **GET /classrooms/:id/assignments**
   - Should have `config` field in response
   - Should not error with 500

2. **GET /classrooms/:id/corpus**
   - Files with storage_path: `download_url` is a signed URL
   - Files without storage_path: `download_url` is null, `download_url_error` is "File was not uploaded"

3. **POST /classrooms/:id/corpus**
   - Request body includes: `{ display_name, file_type, has_file: true }`
   - Response includes: `upload_url` (if has_file was true)

---

## 📊 Summary Checklist

### Teacher Side
- [ ] Assignments load without config errors
- [ ] New corpus files upload successfully
- [ ] Existing corpus files still work
- [ ] Corpus file downloads work
- [ ] Corpus file moves work
- [ ] Corpus file deletion works
- [ ] Folder operations work correctly
- [ ] No "Failed to fetch" errors on corpus files

### Student Side
- [ ] Assignments load correctly
- [ ] Assignment files are accessible
- [ ] Context files (corpus) work if used
- [ ] No regression in student experience

### Code Quality
- [ ] No Python syntax errors
- [ ] No TypeScript compilation errors
- [ ] All migrations applied successfully
- [ ] Git status shows expected changes only

---

## 🐛 Known Issues / Edge Cases

### Non-Issues (Expected Behavior)
1. **Existing corpus files created before this fix** will have `storage_path` populated (not null). This is correct - only NEW files created without upload will have null storage_path.

2. **"File was not uploaded" error** only appears if a corpus record was created but the file upload failed/was skipped. This is rare and indicates a legitimate issue.

### Potential Issues to Watch
1. **Timezone/Date Display**: Check that `uploaded_at` still displays correctly after changes
2. **Folder Path Edge Cases**: Empty folder paths, paths with special characters
3. **File Type Validation**: Ensure all allowed file types still work

---

## 🎯 Quick Smoke Test (5 minutes)

**Fastest way to verify everything works:**

```bash
# 1. Start backend
cd teacher/backend && python run.py

# 2. In browser, test assignment view
# Navigate to: http://localhost:5001/classrooms/{any-classroom-id}/assignments
# Expected: No errors

# 3. Test corpus upload
# Navigate to corpus tab → upload a PDF
# Expected: Upload succeeds, file appears, download works

# 4. Check backend logs
# Expected: No errors, no "config does not exist" messages
```

If all three pass: ✅ **Ready to commit and deploy**

---

## 📝 Notes

- **Migration Safety**: Both migrations use `IF NOT EXISTS` and `DROP NOT NULL`, so they're safe to re-run
- **Rollback**: If issues arise, can restore by re-adding NOT NULL constraint to corpus_files.storage_path (but only if ALL existing records have non-null values)
- **Performance**: No performance impact - all queries unchanged, just null handling added
- **Security**: No security concerns - same auth/ownership checks in place
