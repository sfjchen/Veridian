"""
Pipeline for analyzing student LaTeX solutions against reference solutions.

Identifies mistakes, annotates them, continues the student's approach, and tracks
mistakes over time. Intended for programmatic use only via MistakeAnalyzer.run().

Inputs:
    - student_tex: str (LaTeX of student's attempted solution)
    - reference_tex: str (LaTeX of reference/correct solution)
    - context_tex: str (LaTeX of relevant course material)

Outputs (returned by MistakeAnalyzer.run()):
    - annotated_tex: str (student's work with \\mistake{} annotations)
    - continuation_tex: str (continuation of student's approach)
    - mistakes.json updated with new entries
"""

import anthropic
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

from anthropic_guard import validate_anthropic_thinking_support
from .constants import TAG_BANK, SEVERITIES, TAG_TO_SEVERITY, ALL_TAGS
from .prompts import ANALYSIS_SYSTEM_PROMPT, GRADER_SYSTEM_PROMPT, CONTINUATION_SYSTEM_PROMPT
from .helpers import escape_latex_text, extract_json_from_llm_response, extract_text, find_snippet, in_math_mode as _in_math_mode

logger = logging.getLogger(__name__)


class MistakeAnalyzer:
    """
    Main pipeline class. Orchestrates analysis, verification, annotation,
    continuation, and mistake tracking.
    """

    def __init__(
        self,
        mistakes_json_path: str = "mistakes.json",
        analysis_model: str = "claude-opus-4-6",
        grader_model: str = "claude-sonnet-4-5-20250929",
        continuation_model: str = "claude-sonnet-4-5-20250929",
        use_extended_thinking: bool = True,
        max_tokens: int | None = None,
    ):
        self.client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var
        validate_anthropic_thinking_support(
            self.client,
            anthropic_version=getattr(anthropic, "__version__", None),
        )
        self.mistakes_path = Path(mistakes_json_path)
        self.analysis_model = analysis_model
        self.grader_model = grader_model
        self.continuation_model = continuation_model
        self.use_extended_thinking = use_extended_thinking
        try:
            _cap = int(os.getenv("MISTAKE_ANALYSIS_MAX_TOKENS", "8192").strip())
        except ValueError:
            _cap = 8192
        self.max_tokens = max(1024, max_tokens) if max_tokens is not None else max(1024, _cap)

        backend = (os.getenv("MISTAKE_ANALYSIS_BACKEND", "anthropic") or "anthropic").strip().lower()
        self._backend = "openai" if backend == "openai" else "anthropic"
        if self._backend == "openai":
            self._openai_client = OpenAI()
            self._openai_model = (os.getenv("MISTAKE_ANALYSIS_OPENAI_MODEL", "gpt-4o") or "gpt-4o").strip()
        else:
            self._openai_client = None
            self._openai_model = ""

        # load or initialize mistake history
        if self.mistakes_path.exists():
            try:
                with open(self.mistakes_path) as f:
                    self.mistake_history = json.load(f)
            except json.JSONDecodeError:
                logger.warning(
                    "Corrupted %s — starting fresh.", self.mistakes_path
                )
                self.mistake_history = {"mistakes": [], "sessions": []}
        else:
            self.mistake_history = {"mistakes": [], "sessions": []}

    def _call_api(self, context: str, **kwargs):
        """Wrapper around client.messages.create with error handling."""
        try:
            return self.client.messages.create(**kwargs)
        except anthropic.APIError as exc:
            raise ValueError(
                f"Anthropic API error during {context}: {exc}"
            ) from exc

    def _request_text(
        self,
        context: str,
        system: str,
        user_msg: str,
        max_tokens: int,
        anthropic_model: str,
        use_thinking: bool = False,
    ) -> str:
        """Call LLM (Anthropic or OpenAI per MISTAKE_ANALYSIS_BACKEND) and return response text."""
        if self._backend == "anthropic":
            kwargs = {
                "model": anthropic_model,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user_msg}],
            }
            if use_thinking:
                kwargs["temperature"] = 1
                kwargs["thinking"] = {"type": "adaptive"}
            response = self._call_api(context, **kwargs)
            return extract_text(response)
        try:
            response = self._openai_client.chat.completions.create(
                model=self._openai_model,
                max_completion_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
            )
        except Exception as exc:
            raise ValueError(f"OpenAI API error during {context}: {exc}") from exc
        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ValueError(f"OpenAI returned empty response during {context}")
        return content

    def _analyze(
        self, student_tex: str, reference_tex: str, context_tex: str
    ) -> dict:
        tags_formatted = "\n".join(
            f"  [{sev}] {', '.join(tags)}" for sev, tags in TAG_BANK.items()
        )
        system = ANALYSIS_SYSTEM_PROMPT.format(tags_formatted=tags_formatted)

        user_msg = (
            f"<course_context>\n{context_tex}\n</course_context>\n\n"
            f"<reference_solution>\n{reference_tex}\n</reference_solution>\n\n"
            f"<student_attempt>\n{student_tex}\n</student_attempt>"
        )
        use_thinking = self.use_extended_thinking and "opus" in self.analysis_model.lower()

        for attempt in range(2):
            text = self._request_text(
                "analysis",
                system,
                user_msg,
                self.max_tokens,
                self.analysis_model,
                use_thinking=use_thinking,
            )
            try:
                return extract_json_from_llm_response(text, "analysis")
            except ValueError:
                if attempt == 0:
                    logger.warning("Analysis JSON parse failed, retrying...")
                    continue
                raise

    def _verify(
        self, student_tex: str, reference_tex: str, analysis: dict
    ) -> dict:
        user_msg = (
            f"<reference_solution>\n{reference_tex}\n</reference_solution>\n\n"
            f"<student_attempt>\n{student_tex}\n</student_attempt>\n\n"
            f"<analysis>\n{json.dumps(analysis, indent=2)}\n</analysis>"
        )

        for attempt in range(2):
            text = self._request_text(
                "verification",
                GRADER_SYSTEM_PROMPT,
                user_msg,
                self.max_tokens,
                self.grader_model,
            )
            try:
                return extract_json_from_llm_response(text, "verification")
            except ValueError:
                if attempt == 0:
                    logger.warning("Verification JSON parse failed, retrying...")
                    continue
                raise

    def _reconcile(self, analysis: dict, verification: dict) -> dict:
        """
        Merge the original analysis with the grader's verdict.
        Drops false positives, applies corrections, adds missed mistakes.
        """
        original_mistakes = analysis.get("mistakes", [])
        verified = verification.get("verified_mistakes", [])
        missed = verification.get("missed_mistakes", [])

        # build lookup of verdicts by index
        verdicts = {v["original_index"]: v for v in verified}

        reconciled = []
        for i, mistake in enumerate(original_mistakes):
            v = verdicts.get(i)
            if v is None:
                # grader didn't comment on it — keep as-is
                reconciled.append(mistake)
            elif v["verdict"] == "false_positive":
                continue  # drop it
            elif v["verdict"] == "mistagged":
                mistake["tag"] = v.get("corrected_tag", mistake["tag"])
                mistake["severity"] = v.get("corrected_severity", mistake["severity"])
                reconciled.append(mistake)
            else:
                reconciled.append(mistake)

        # add missed mistakes
        reconciled.extend(missed)

        # validate all tags
        for m in reconciled:
            if m["tag"] not in ALL_TAGS:
                # fall back to closest severity bucket's first tag
                sev = m.get("severity", "mechanical")
                m["tag"] = TAG_BANK.get(sev, TAG_BANK["mechanical"])[0]
            if m.get("severity") not in SEVERITIES:
                m["severity"] = TAG_TO_SEVERITY.get(m["tag"], "mechanical")

        analysis["mistakes"] = reconciled
        return analysis

    def _continue(
        self,
        student_tex: str,
        reference_tex: str,
        context_tex: str,
        analysis: dict,
    ) -> str:
        user_msg = (
            f"<course_context>\n{context_tex}\n</course_context>\n\n"
            f"<reference_solution>\n{reference_tex}\n</reference_solution>\n\n"
            f"<student_attempt>\n{student_tex}\n</student_attempt>\n\n"
            f"<mistake_analysis>\n{json.dumps(analysis, indent=2)}\n</mistake_analysis>"
        )

        return self._request_text(
            "continuation",
            CONTINUATION_SYSTEM_PROMPT,
            user_msg,
            self.max_tokens,
            self.continuation_model,
        )

    def _annotate(self, student_tex: str, mistakes: list[dict]) -> str:
        """
        Insert \\mistake{...}{...}{...}{...} commands into the student's LaTeX source.

        Strategy: for each mistake, find the erroneous snippet using
        location_hint + erroneous_latex, then wrap it. We process
        mistakes in reverse document order to preserve string indices.
        """
        annotated = student_tex

        # find locations using matched spans from find_snippet
        located: list[tuple[int, int, dict]] = []
        for m in mistakes:
            snippet = m["erroneous_latex"]
            hint = m.get("location_hint", "")

            start, end = find_snippet(annotated, snippet, hint)
            if start != -1:
                located.append((start, end, m))

        # sort by start ascending, then by span width descending (wider first)
        # so that when we deduplicate, the outermost range wins
        located.sort(key=lambda x: (x[0], -(x[1] - x[0])))

        # deduplicate overlapping ranges — keep the outermost (widest) one
        deduped: list[tuple[int, int, dict]] = []
        for entry in located:
            start, end, _ = entry
            if deduped and start < deduped[-1][1]:
                # overlaps with the previous accepted range — skip
                continue
            deduped.append(entry)

        # reverse for safe index-preserving replacement
        deduped.reverse()

        for start, end, m in deduped:
            original = annotated[start:end]
            explanation = escape_latex_text(m["explanation"])
            tag = m["tag"]
            severity = m["severity"]
            macro = "\\mistake" if _in_math_mode(annotated, start) else "\\mistaketext"
            replacement = f"{macro}{{{original}}}{{{explanation}}}{{{tag}}}{{{severity}}}"
            annotated = annotated[:start] + replacement + annotated[end:]

        # ensure preamble include is present
        if "mistake_preamble" not in annotated:
            # insert after \documentclass or at top
            dc_end = annotated.find("\\begin{document}")
            if dc_end != -1:
                annotated = (
                    annotated[:dc_end]
                    + "\\input{mistake_preamble}\n"
                    + annotated[dc_end:]
                )
            else:
                annotated = "\\input{mistake_preamble}\n" + annotated

        return annotated

    def _update_history(self, analysis: dict, student_id: str = "default") -> None:
        timestamp = datetime.now(timezone.utc).isoformat()
        session = {
            "student_id": student_id,
            "timestamp": timestamp,
            "approach_assessment": analysis["approach_assessment"],
            "approach_notes": analysis["approach_notes"],
            "mistake_count": len(analysis["mistakes"]),
        }
        self.mistake_history["sessions"].append(session)

        for m in analysis["mistakes"]:
            entry = {
                "student_id": student_id,
                "timestamp": timestamp,
                "tag": m["tag"],
                "severity": m["severity"],
                "explanation": m["explanation"],
                "erroneous_latex": m["erroneous_latex"],
            }
            self.mistake_history["mistakes"].append(entry)

        with open(self.mistakes_path, "w") as f:
            json.dump(self.mistake_history, f, indent=2)

    def run(
        self,
        student_tex: str,
        reference_tex: str,
        context_tex: str,
        student_id: str = "default",
        include_solution: bool = True,
    ) -> dict:
        """
        Run the full analysis pipeline.

        Args:
            include_solution: If False, skip continuation step (no LLM solution output).

        Returns:
            {
                "analysis": { ... },
                "annotated_tex": "...",
                "continuation_tex": "..." or "",
                "mistakes_logged": int,
            }
        """
        analysis = self._analyze(student_tex, reference_tex, context_tex)
        verification = self._verify(student_tex, reference_tex, analysis)
        analysis = self._reconcile(analysis, verification)

        if include_solution:
            with ThreadPoolExecutor(max_workers=2) as pool:
                continue_future = pool.submit(
                    self._continue, student_tex, reference_tex, context_tex, analysis
                )
                annotate_future = pool.submit(
                    self._annotate, student_tex, analysis["mistakes"]
                )
                continuation = continue_future.result()
                annotated = annotate_future.result()
        else:
            continuation = ""
            annotated = self._annotate(student_tex, analysis["mistakes"])

        try:
            self._update_history(analysis, student_id)
        except Exception:
            logger.exception("Failed to update mistake history — continuing.")

        return {
            "analysis": analysis,
            "annotated_tex": annotated,
            "continuation_tex": continuation,
            "mistakes_logged": len(analysis["mistakes"]),
        }
