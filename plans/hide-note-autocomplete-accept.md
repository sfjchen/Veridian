# Hide Autocomplete Accept Button In Student Notes

## Summary
Remove the manual autocomplete "Accept" action from the student note-taking flow while keeping autocomplete suggestion ghost text visible. This is a frontend-only change with no backend impact.

## Scope
1. Student note-taking screen only: `student/frontend/app/note/[id].tsx`
2. Student `InkCanvas` toolbar UI/API cleanup: `student/frontend/components/InkCanvas.tsx`
3. Autocomplete hook cleanup for removed accept flow: `student/frontend/hooks/useStrokeAutocomplete.ts`

## Out Of Scope
1. Teacher frontend and teacher student-view components
2. Backend autocomplete generation
3. Any change to suggestion quality/content

## Public API / Interface Changes
1. `InkCanvasProps` removes:
- `showAcceptButton?: boolean`
- `onAccept?: () => void`
- `beforeUndo?: () => boolean`
- `beforeRedo?: () => boolean`
- `hasExternalUndo?: boolean`
- `hasExternalRedo?: boolean`

2. `AutocompleteOpts` removes:
- `completedLineKeys?: Set<string>`

3. `AutocompleteState` no longer exposes:
- `targetLineKey`

## Implementation Plan (Single Small PR)
1. Create branch from `main`: `codex/hide-note-autocomplete-accept`.
2. Add this plan file.
3. Update `student/frontend/app/note/[id].tsx`:
- Remove `AcceptedSuggestion` and accept-history state.
- Remove `handleAccept`, `beforeUndo`, `beforeRedo`.
- Remove accept-related props passed to `InkCanvas`.
- Keep ghost suggestion rendering from autocomplete state.
- Remove rendering of persisted accepted suggestions.
4. Update `student/frontend/components/InkCanvas.tsx`:
- Delete accept button JSX and styles.
- Remove external accept undo/redo interception props and logic.
- Keep normal stroke undo/redo behavior.
5. Update `student/frontend/hooks/useStrokeAutocomplete.ts`:
- Remove `completedLineKeys` option and filtering branch.
- Keep line-grouping and bbox targeting for ghost display.
- Keep same-line dismiss behavior with internal line-key tracking only.
6. Verification:
- Run `npm run lint` in `student/frontend`.
- Run `npx tsc --noEmit` in `student/frontend`.

## Test Cases And Scenarios
1. Suggestion appears and no Accept button is visible.
2. Toolbar no longer contains "Accept suggestion" accessibility label.
3. Ghost suggestion still renders at target line.
4. Undo/redo still works for stroke operations.
5. Clearing canvas still works and dismisses active suggestion.
6. No TypeScript/lint errors after API cleanup.

## Success Criteria
1. Note-taking UI no longer shows or allows tapping an Accept button.
2. Autocomplete ghost preview remains visible and functional.
3. No regressions in draw/erase/clear/undo/redo.
4. Lint and type-check pass.

## Assumptions And Defaults
1. Full removal of manual accept flow and dead code.
2. Keep ghost suggestion preview.
3. Applies across web/iOS/Android for student notes.
4. No backend or database changes required.
