Original prompt: lets do it

2026-03-22
- Reworking social interactions away from hardcoded scripted outcomes.
- Goal now: LLM-authored visible dialogue, proximity-based conversations, speech bubbles, and AI-chosen memories/promises instead of deterministic "Agent X chatted with Agent Y" text.
- Need to preserve autonomy: conversations should create context and consequences, not forced execution.
2026-03-22
- Added LLM-authored conversation path and visible speech bubbles.
- Talk movement now stops within nearby range instead of forcing overlap.
- Need live validation on bubble readability and whether conversation cadence feels natural.
- Prevented duplicate same-tick talk resolution by briefly locking both participants into the same talk state.
- Added talk timeout/reset so agents cannot remain stuck in talking if async resolution drops out.\n- Reworked action prompt into a compact decision brief with explicit affordances and tool prerequisites, especially the axe -> tree workflow.
