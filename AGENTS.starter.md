# AGENTS.md

## Repo purpose
Build a local Web UI app that turns Japanese articles or notes into a 4-stage artifact package for ElevenLabs v3:
1. brief
2. spoken_script
3. eleven_v3_prompt
4. qa_report

## Non-negotiable workflow
- Never convert article/note directly to final prompt in one step.
- Always preserve stage separation:
  - note -> brief
  - brief -> spoken_script
  - spoken_script -> eleven_v3_prompt
  - qa_report
- Save intermediate artifacts to disk.
- Keep mock mode available alongside real mode.

## Product quality rules
- Optimize for conversational Japanese, not polished written Japanese.
- Reduce lecture-like delivery.
- Favor listener engagement, empathy, and natural flow.
- The final deliverable is an ElevenLabs v3 prompt package, not audio generation.

## ElevenLabs v3 rules
- Do not use SSML break tags for v3 prompting.
- Control pacing with wording, punctuation, text structure, and minimal inline audio tags.
- Avoid excessive ellipses, excessive line breaks, and excessive tags.
- Keep tags sparse and purposeful.

## Engineering rules
- Keep the existing CLI working.
- UI and API responsibilities must stay separate.
- Real mode must call server-side APIs only.
- Do not expose secrets to the browser.
- Validation failure, refusal, and runtime failure must be distinct error types.

## Required validation
Before marking work complete, run:
- npm run build
- npm run typecheck
- npm run lint
- npm test

If one fails, stop and fix before moving on.

## Documentation sync
When behavior changes, update:
- README.md
- spec.md
- plans.md
