# Models, fallback and provider errors

**English** · [Español](modelos.es.md)

## Model mapping and fallback chain

Current policy (user decision, 2026-11-10 evening). It replaces the previous
four-tier chain.

```text
Primario    → opencode-go/deepseek-v4.1-flash
Fallback 1  → deepseek/deepseek-flash            (crédito directo: ~3 $ restantes)
Fallback 2  → opencode/glm-5.3-flash-free
Fallback 3  → opencode-go/claude-haiku-5-5
```

**Cost rule**: the direct DeepSeek credit is about $3 and it is reserved for when
`opencode-go` exhausts its window. It is not used as the first option even if it is
the same model: subscription first, credit afterwards.

The `zai/*` and `anthropic/*` providers are **not configured** on this machine:
`opencode/glm-5.3-flash-free` is the real equivalent of the free GLM and
`opencode-go/claude-haiku-5-5` the one of Haiku. Do not invent provider IDs.

### Provider error handling (mandatory)

| Situation                     | Action                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **503 / service overloaded**  | Retry with exponential backoff 5 s → 15 s → 45 s. On the fourth attempt, switch to Fallback 1. Fifth failed attempt with Fallback 1: move to Fallback 2. **Never stop the task because of a 503.**                     |
| **429 / rate limit**          | Respect `retry-after`. Without the header: wait 10 s. Maximum 3 retries and then switch fallback.                                                                                                                  |
| **401 / 403 / auth**          | **Do not retry.** Report to the user that the credential is invalid.                                                                                                                                                |
| **Timeout**                   | Retry once with the timeout doubled. If it fails again, switch fallback.                                                                                                                                            |

Associated orchestration rules:

- Maximum **5 total attempts** per sub-task and **3 iterations** before escalating
  to the user.
- If a sub-task fails twice with the same model, the model is changed and the
  sub-task is retried.
- If the subagent delivers code that does not compile, it is returned **with the
  concrete error**; it is not re-run blindly.
- Each sub-task is dispatched **self-contained**: the subagent does not depend on
  another one.
- The **orchestrator** model is not changed, only the subagents' one. If the
  available GLM were not 5.3, the closest available GLM 5.x is used.

| Agent                      | GitHub Copilot (`github-copilot/`) | Codex (`openai/`)    | OpenCode Go (`opencode-go/`) | DeepSeek (`deepseek/`) | Reasoning    |
| -------------------------- | ---------------------------------- | -------------------- | ---------------------------- | ---------------------- | ------------ |
| **Orchestrator**           | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-plan`                 | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-flash#high`  | `high`       |
| `sdd-implement`            | `claude-haiku-5.5#medium`          | `gpt-6-luna#medium`  | `claude-haiku-5-5#medium`    | `deepseek-flash#high`  | `medium`     |
| `sdd-ui`                   | `gpt-5.6-luna#high`                | `gpt-6-luna#high`    | `gpt-6-luna#high`            | `deepseek-flash#high`  | `high`       |
| `sdd-escalation`           | `claude-sonnet-5.5#high`           | `gpt-6.1-sol#high`   | `gemini-4-argon#high`        | `deepseek-v4-pro#high` | `high`       |
| `sdd-second-opinion`       | `gpt-5.6-terra#high`               | `gpt-6.1-terra#high` | `grok-4.7#high`              | `deepseek-v4-pro#high` | `high`       |
| **Final spec review**      | the most powerful model available  | —                    | —                            | —                      | see `T-136`  |

The table is **not** the fallback chain: it fixes the preferred model per role when
that provider is healthy. The fallback chain above is the one applied when the
primary fails.

### Observed state of each tier (2026-11-10, evening)

| Tier               | State                   | Evidence                                                                                                                                                                                                          |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Copilot     | **exhausted**           | `You have exceeded your monthly quota` on `claude-sonnet-5.5` and `gpt-6-luna`                                                                                                                                    |
| Codex (`openai/`)  | **available**           | `gpt-6.1-sol#high` responds                                                                                                                                                                                       |
| OpenCode Go        | **available again**     | Console: 5 h window at 0 %, weekly 40 % used (resets in 4 d 21 h), monthly 20 % used (resets in 29 d 18 h), $0.00 credit; «Cancelled» subscription active 29 d 18 h. `gemini-4-argon#high` responds                    |
| DeepSeek           | **available**           | `deepseek-flash#high` and `deepseek-v4-pro#max` respond; `deepseek-v4.1-flash-free` was overloaded once                                                                                                            |

OpenCode Go quota recovers through the **5-hour window**, not through the day. The
`OpenCode Go usage limit reached` error does not state the reset time: it is
checked in the console.

This table expires: it is updated when availability changes, it is not assumed.

### Priority chain rules

- The model **actually used** is always recorded in `handoff.md`, not the planned
  one.
- When the tier in use is `deepseek-flash`, the orchestrator **raises the
  verification depth**: it repeats the accessibility and screenshot checks that
  the agent declares itself, instead of trusting the log.
- When quota returns, the work in progress is **not restarted**: the task is
  finished with the current model and the change applies to the next task.
- The second opinion must come from a **different family** than the planning one
  when both are available in the same tier.
- Cost-free alternative: `opencode/deepseek-v4.1-flash-free#high` is the same
  DeepSeek model through the free route; the `deepseek` provider is preferred
  because it does not share quota with the free models.
