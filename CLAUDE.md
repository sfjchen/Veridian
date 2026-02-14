# 🚨 MANDATORY WORKFLOW — READ FIRST

STOP. Before writing any code, follow this checklist:

## For New Features

1. Write a plan to `docs/plans/{feature-name}.md` with:
   - What will be built and why
   - Which files will be created/modified
   - Breakdown into small PRs
   - Open questions, success criteria
2. Agent team review (recommended) - Spawn a review team to debate the plan:
   - Architecture reviewer (API design, integration, dependencies)
   - Performance skeptic (memory, CPU, scalability challenges)
   - Testing advocate (edge cases, failure modes, test coverage)
   - Devil's advocate (challenge approach, propose alternatives)
   - Senior quantitative researcher (industry experience from tier-1 funds — challenges assumptions, checks for look-ahead bias, validates statistical methodology, reviews risk management, ensures production readiness). ALWAYS include this role.
   - Let them debate findings, then revise plan based on consensus
   - This catches issues before Ethan sees the plan
3. Wait for Ethan to approve the plan before proceeding
4. Create a feature branch from main
5. Spawn sub-agents to do the actual coding (Claude orchestrates, doesn't code directly)
6. Review sub-agent output for correctness, logic, integration, and style (see review checklist below)
7. Create PR — plan file becomes the PR description basis
8. Comment `@codex review` to trigger code review (see prompt template below)
9. Address Codex feedback — fix issues, push updates, then comment `@codex review` again
10. Update this file's roadmap checkboxes when work completes

## For Bug Fixes / Small Changes

- Skip the plan if it's truly trivial (< 10 lines, obvious fix)
- Still use sub-agents for code changes

## After Completing Work

- Document any decisions or dead ends in PR description
- **Update `docs/PLAN.md`**: Mark completed tasks, add new tasks discovered during work, update architecture decisions if any were made

---

# Code Style Rules

These apply to ALL code written by Claude or sub-agents:

- Type hints on all function signatures
- Minimal comments — code should be self-documenting
- No verbose logging — code runs quietly unless there's an error (errors to stderr)
- Precision over generalization — no aliases, wrappers, or flexibility that isn't needed. Use exact formats (e.g., Tardis expects SOLUSDT, not SOL-PERP)
- Smart file splitting — driver files orchestrate, modules do one thing
- Numpy for vectorized ops where possible

---

# Code Philosophy

Optimize for reading, not writing. Code is read 10x more than it's written.

The core heuristic: "Would a tired engineer at 2am understand this immediately?" If not, simplify.

## Function Design

- ~20 lines max unless genuinely cleaner as one unit (e.g., a state machine)
- Single responsibility — if you need "and" to describe what it does, split it
- Flat over nested — early returns, guard clauses at the top
- Max 3 parameters — if you need more, you probably need a dataclass or config object

## Simplicity Rules

- No premature abstraction — write it twice before you generalize (Rule of Three)
- No "just in case" code — if it's not used now, delete it
- Explicit over clever — a 5-line obvious solution beats a 2-line puzzle
- One way to do things — don't offer multiple paths to the same result

## Design Smells to Reject

- Classes with only `__init__` and one method → use a function
- Inheritance for code reuse → use composition or just copy the 3 lines
- Config dicts passed everywhere → make a typed dataclass
- String literals repeated → extract to constants only if >2 uses AND non-obvious

## Control Flow

- Fail fast — validate inputs at function entry, not deep inside
- No silent failures — if something unexpected happens, raise, don't return None
- Avoid boolean parameters — `process(data, include_fees=True)` → hard to read at call site. Consider two functions or an enum.

---

# Sub-Agent Conventions

When spawning sub-agents, always include these instructions:

**Code style requirements:**
- Type hints on all function signatures
- No print statements (errors to stderr only)
- No verbose logging
- Use exact formats, no convenience aliases

**Also provide:**
- Relevant data formats (e.g., parquet schema) if the task involves data
- File paths to read for context
- Clear success criteria

## Claude's Review Responsibilities

Claude is the orchestrator/reviewer. Sub-agents write code. Before committing, Claude must review for:

- **Correctness** — Does the code actually do what it's supposed to? Test it if possible.
- **Logic errors** — Are there bugs, off-by-one errors, unhandled edge cases?
- **Integration** — Does it work with existing code? Are imports correct?
- **Requirements match** — Does it match the plan/spec? Any missing pieces?
- **Style compliance** — Type hints, no verbose logging, etc.

If sub-agent output has issues, iterate with them or fix it before committing. Don't commit code you haven't reviewed.

## PR Review Prompt Template

When ready for review, comment this on the PR:

> @claude Review this PR with extreme attention to detail. Be meticulous and skeptical.
>
> Check for:
> 1. **Correctness** — Trace logic step-by-step. Off-by-one errors? Edge cases? Empty/null inputs?
> 2. **Data integrity** — Schema consistency? Type correctness (int vs float)? Timestamp units (ms vs μs)?
> 3. **Error handling** — Silent failures? Errors propagated correctly?
> 4. **Logic smells** — Magic numbers? Clever code that's hard to understand?
>
> For each issue: File:Line, severity (P0/P1/P2), suggested fix.
> Assume bugs exist until proven otherwise.

## Checking Review Comments

Review bots leave feedback — always check:

- **Codex (OpenAI):** Leaves traditional GitHub PR review comments (inline on diffs + review summary). Check via `gh api repos/{owner}/{repo}/pulls/{n}/comments` and `gh api repos/{owner}/{repo}/pulls/{n}/reviews`.
- All issues (P0, P1, P2) must be addressed before merging. Fix the code, push, and reply explaining what was fixed.

---

# Parallel Work

- **Default:** Use subagents (Task tool) for coding tasks — focused, lower token cost.
- **Agent teams:** For research, plan review, or any task where agents need to debate and challenge each other. See `docs/AGENT-TEAM-WORKFLOW.md` for setup and usage.
