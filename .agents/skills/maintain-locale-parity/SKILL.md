---
name: maintain-locale-parity
description: Keep English-primary and Spanish documents and UI catalogs equivalent. Use when editing README.md/README.es.md, public docs, or translation catalogs, or when asked to "update both languages" or "translate this doc".
---

# Maintain locale parity

The policy is in `docs/quality-gates.md` ("Document language policy"); if that file does not exist yet, use the
constitution's language section.

## Steps

1. Identify the pair: `X.md` with `X.es.md`, `README.md` with `README.es.md`, or the en/es UI catalogs.
2. Make the change in English first, then the equivalent Spanish change in the **same commit**. Keep headings
   and section order identical, so both files keep the same number of sections.
3. Keep commands, paths and code blocks byte-identical across languages; translate only the prose.
4. Run `pnpm check:locale-parity` and `pnpm lint:md`, and keep both outputs.

## Done when

Both checks pass, and both files have the same sections in the same order.

## Never

- Machine-translate code blocks or command flags.
- Leave a Spanish section "to do later".
- Add parity to internal SDD artifacts (`specs/*`), which are Spanish only.
