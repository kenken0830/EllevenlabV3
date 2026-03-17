# Handoff

## Current State
- Project: Japanese note -> brief -> spoken_script -> eleven_v3_prompt -> qa_report pipeline with Web UI and CLI.
- Real mode uses OpenAI on the server side via `.env.local`.
- Web UI and CLI are both working.
- The pipeline remains strictly separated:
  - `note -> brief`
  - `brief -> spoken-script`
  - `spoken-script -> eleven-v3-prompt`
  - `qa`

## Current Focus
- Spoken downstream tuning is intentionally not being expanded further.
- Current work is focused on improving `note-to-brief` upstream quality.
- The latest tuning adds brief few-shot examples for:
  - fear / hesitation
  - habit / self-blame

## Important Files
- Repo rules: [AGENTS.md](/D:/Cursor/GouseiShoshi/AGENTS.md)
- Skill entry: [SKILL.md](/D:/Cursor/GouseiShoshi/.agents/skills/eleven-v3-ja-pipeline/SKILL.md)
- Brief few-shot reference: [brief-body-examples.md](/D:/Cursor/GouseiShoshi/.agents/skills/eleven-v3-ja-pipeline/references/brief-body-examples.md)
- Brief stage: [note-to-brief.ts](/D:/Cursor/GouseiShoshi/src/stages/note-to-brief.ts)
- Spoken stage: [brief-to-spoken-script.ts](/D:/Cursor/GouseiShoshi/src/stages/brief-to-spoken-script.ts)
- QA stage: [qa.ts](/D:/Cursor/GouseiShoshi/src/stages/qa.ts)
- Tests: [brief-body-quality.test.ts](/D:/Cursor/GouseiShoshi/tests/unit/brief-body-quality.test.ts)

## What Changed Recently
- Added a brief quality gate in `note-to-brief`.
- Flow is:
  - initial brief generation
  - inspect brief body issues
  - one repair pass
  - fail with `validation_error` if still overstructured
- Added contrastive few-shot examples and included them in both initial brief generation and brief repair.
- Validation error messages now include offending lines.

## Latest Validation
- Passed:
  - `npm run build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`

## Latest Real Runs
- Completed:
  - `artifacts/real-brief-fewshot-v2-note-01`
  - `artifacts/real-brief-fewshot-v2-note-02`
  - `artifacts/real-brief-fewshot-v2-note-03`
- Comparison baseline:
  - `artifacts/real-brief-gated-v4-note-01`
  - `artifacts/real-brief-gated-v6-note-02`
  - `artifacts/real-brief-gated-v4-note-03`

## Observed Quality Outcome
- `note-03` improved the most in `01-brief.json`.
- `note-01` improved moderately.
- `note-02` still tends to drift toward mild advice framing.
- `final_prompt` remains paste-ready and tag-light.

## Recommended Next Step
- Keep regex rules stable.
- Continue tuning `note-to-brief` with example-driven prompt changes instead of adding more downstream constraints.
- If tuning continues, focus on making `note-02` body stay in recognition/reframe while pushing concrete action into `close_action`.

## Environment Notes
- API config file: `/.env.local`
- Do not commit `.env.local`.
- Real mode requires:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
