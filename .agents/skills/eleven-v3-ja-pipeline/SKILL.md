---
name: eleven-v3-ja-pipeline
description: Convert a Japanese article or note into a 4-stage ElevenLabs v3 prompt package. Use when asked to turn Japanese source text into brief, spoken_script, eleven_v3_prompt, and qa_report for warm, conversational, low-explainer voice delivery. Do not use for direct audio generation or non-Japanese content.
---

# Goal
Create four artifacts from a Japanese article or note:
1. `brief`
2. `spoken_script`
3. `eleven_v3_prompt`
4. `qa_report`

The final output must be optimized for ElevenLabs v3 prompting, with conversational Japanese and low explainer tone.

# Required workflow
Never skip stages.
Always use this order:
1. `note -> brief`
2. `brief -> spoken_script`
3. `spoken_script -> eleven_v3_prompt`
4. `qa_report`

Do not jump from source text directly to the final prompt.

# Stage instructions
## 1) brief
Extract the core message and listener problem.
Define:
- `core_message`
- `listener_problem`
- `empathy_hook`
- `talking_points`
- `section_plan`
- `style_targets`
- `style_avoid`

Focus on what the speaker is really trying to say and where the listener should feel understood.

## 2) spoken_script
Turn the brief into natural spoken Japanese.
Priorities:
- start with empathy or situation mirroring
- avoid lecture cadence
- shorten explanation chains
- reduce stiff written-Japanese phrasing
- do not make every sentence land as a full stop
- keep flow easy to listen to aloud

When in doubt, prefer something a smart, warm person would naturally say to one listener.

## 3) eleven_v3_prompt
Turn the spoken script into a prompt package specifically for ElevenLabs v3.
Follow these rules:
- v3 prompting should not rely on SSML break tags
- shape pacing with wording, punctuation, text structure, and very light inline audio tags
- avoid excessive ellipses
- avoid excessive line breaks
- avoid too many tags
- prefer a warm, conversational, engaging tone over polished narration
- make the final prompt easy to paste into ElevenLabs v3

The artifact must include:
- `performance_goal`
- `performance_rules`
- `avoid_rules`
- `final_prompt`

## 4) qa_report
Evaluate the full chain and say what to fix.
Score at least these:
- `hook_strength`
- `low_explainer_tone`
- `spoken_naturalness`
- `emotion_curve`
- `eleven_prompt_naturalness`

Also check for:
- too many pauses
- too many ellipses
- too many line breaks
- too many tags
- obvious lecture tone
- weak opening hook

If quality is weak, point to the stage that should be revised.

# Output requirements
- Preserve JSON-compatible structure.
- Keep artifact names stable.
- Make the final prompt practical and paste-ready.
- If the source is weak, still produce the best possible artifact package and explain the weakness in QA.

# When to refuse or stop
- Stop if the source is not Japanese and the user asked specifically for Japanese output.
- Stop if required input is missing.
- If schema validation fails, do not continue to the next stage.
- Distinguish refusal, validation failure, and runtime error.

# References
Read these before editing stage logic:
- `references/eleven-v3-rules.md`
- `references/spoken-japanese-rules.md`
- `references/qa-rubric.md`
