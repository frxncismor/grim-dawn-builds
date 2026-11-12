---
name: review-source-rights
description: Assess whether a third-party source (forum post, video, site, author) may be used or adapted, before any content is based on it. Use when asked to "use this source", "adapt this guide", "can we use X" or "review rights".
---

# Review source rights

Read `docs/content/source-policy.md` first, and `docs/content/source-change-review.md` and
`docs/content/forum-source-assessment.md` if they exist. Read-only: you assess, you do not publish.

## Steps

1. Identify the source exactly: URL, author or individual owner, date, and the license or terms page.
2. Classify the use the request needs: `link-only`, `quote` (short, attributed) or `adaptation`.
3. Check what the policy allows for that use and that kind of source. Adaptation needs explicit permission
   evidence that the rights schema can record.
4. Write the assessment as a short record:

   ```text
   Source: <url> · Owner: <who> · License/terms: <what, with link>
   Requested use: <link-only|quote|adaptation>
   Policy says: <rule, with file:line>
   Verdict: allowed | allowed as link-only | blocked (needs permission from <who>)
   ```

5. If any part is uncertain, the verdict is **blocked** or **link-only**; never "probably fine".

## Done when

There is a verdict with the policy citation and evidence links, and the orchestrator records it in the task or
content metadata.

## Never

- Copy or paraphrase third-party content to "test" it.
- Treat attribution as permission.
