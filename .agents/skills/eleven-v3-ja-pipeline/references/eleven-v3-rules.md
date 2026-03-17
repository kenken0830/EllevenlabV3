# ElevenLabs v3 rules for this repo

Use these rules when producing `eleven_v3_prompt`.

## Core principles
- The final target is ElevenLabs v3 prompting.
- Voice choice matters more than clever prompting.
- v3 pacing should be shaped mainly with wording, punctuation, text structure, and very light inline tags.
- Do not depend on SSML break tags for v3.
- The final prompt should feel paste-ready, restrained, and easy to perform naturally.

## Tone target
- warm
- conversational
- easy to follow
- emotionally engaging without sounding theatrical
- closer to a creator talking to one person than a narrator reading copy

## What final_prompt should be
- mostly the actual spoken script, not an essay about how to perform it
- one coherent flow, not a list of instructions
- natural Japanese first, performance control second
- tight enough that the reader does not over-pause between every sentence

## Good prompt behavior
- open close to the listener
- sound like one person talking to one person
- build temperature gradually
- make the important sentence land, but not every sentence
- keep the prompt paste-ready for ElevenLabs v3
- use commas, sentence shape, and light paragraphing instead of heavy pause signaling

## Avoid
- lecture rhythm
- heavy-handed narration
- excessive ellipses
- excessive line breaks
- excessive inline tags
- overly polished written Japanese
- rigidly symmetrical sentence shapes
- prompt text that feels like a script for a presentation

## final_prompt formatting rules
- Prefer 1 to 3 short paragraphs at most.
- Do not put every sentence on its own line.
- Avoid blank lines unless there is a meaningful temperature shift.
- Keep inline tags at zero unless truly needed; if used, keep them sparse and purposeful.
- Avoid repeated ellipses; use ordinary punctuation first.
- Avoid over-signaling pauses. If the wording already breathes naturally, do not add more pause cues.

## Language rules for natural delivery
- Remove definitional sentences that explain the topic from above.
- Cut lines that sound like advice columns or seminar notes.
- Reduce phrases like:
  - "まず"
  - "具体的には"
  - "次のステップとして"
  - "重要です"
  - "注目されています"
  - "お伝えします"
- Prefer phrasing that feels spoken in one pass.

## Heuristics
- If the prompt sounds too polished, make it slightly looser.
- If the prompt invites a pause after every sentence, tighten the flow.
- If the opening explains instead of connects, rewrite the first 1 to 2 lines.
- If a paragraph feels like a lecture block, shorten it and re-center the listener.
