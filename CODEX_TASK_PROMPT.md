Paste this into Codex app:

Build the best implementation for this repository using the existing Web UI app as the base.

Goal:
Turn a Japanese article or note into a 4-stage artifact package for ElevenLabs v3:
1. brief
2. spoken_script
3. eleven_v3_prompt
4. qa_report

Most important requirement:
The final deliverable is the ElevenLabs v3 prompt package, especially `03-eleven-v3-prompt.json` with a strong `final_prompt`.

Behavior rules:
- Never convert source text directly to final prompt in one step.
- Always preserve stage separation.
- Optimize for conversational Japanese, low explainer tone, and listener engagement.
- For ElevenLabs v3:
  - do not use SSML break tags
  - use wording, punctuation, text structure, and sparse inline audio tags for pacing
  - avoid excessive ellipses, line breaks, and tags

Implementation rules:
- Keep the current CLI working.
- Use the Web UI as the main surface.
- Add real mode and keep mock mode.
- Real mode must run server-side only.
- Do not expose secrets to the browser.
- Validation failure, refusal, and runtime failure must be separate error kinds.
- Save intermediate artifacts and manifest.json.

What to add:
- repo-local skill in `.agents/skills`
- keep AGENTS.md small and durable
- stage-specific schemas
- UI support for viewing all artifacts and copying `final_prompt`
- clear stage failure reporting

Validation:
- npm run build
- npm run typecheck
- npm run lint
- npm test
- manual check for one sample through the Web UI

First, inspect the repo and update the implementation plan.
Then implement only the smallest set of changes needed to make the real pipeline reliable.
