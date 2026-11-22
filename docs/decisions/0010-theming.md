# 0010 — Theming: one token set, two schemes, an attribute on `<html>`

**Status:** accepted · **Supersedes:** nothing · **Builds on:** the token discipline in `globals.css`

## Context

The original scheme (mint `#74e0a4` on `#08090b`) was a single dark palette baked into CSS
variables. Readers asked for a calmer scheme and a light option. Every component already reads
colours exclusively through tokens (`--bg`, `--surface`, `--accent`, …), which makes theming a
data problem, not a refactor: the question was only where the second value set lives and how the
choice is applied without a flash or a hydration mismatch.

## Decision

- **Muted palette.** Ink navy surfaces with a desaturated indigo accent (`#94a7d9` dark,
  `#4763ac` light). Muted is a requirement, not a taste note: the accent sits beside prices in
  nearly every row, and a saturated accent at that density reads as noise and ages quickly.
  The light accent *deepens* rather than lightens, because the dark accent on white fails the
  contrast the dark theme passes.
- **One attribute.** `:root[data-theme='light']` redeclares the same tokens. No component,
  utility, or inline style names a colour, so fifteen screens reskin together and cannot drift
  per-page. The few baked-in `rgb(232 234 238 / …)` neutrals in `globals.css` became
  `color-mix(in srgb, var(--fg) …)` for the same reason.
- **No-flash application.** A blocking inline script in `<head>` sets `data-theme` from
  localStorage (or the OS preference on first visit) before first paint. The server always
  renders the dark token set and `suppressHydrationWarning` covers the attribute; the toggle
  (`ThemeToggle`) owns the attribute after hydration and persists flips. A failed localStorage
  write degrades to a per-page theme, silently.
- The badge SVG is a standalone document and keeps the dark-theme accent in both site themes:
  it has to read on any README background, and quoting the site scheme exactly is the point.

## Consequences

The design scanner renders server HTML (dark), so light-theme contrast is asserted by token
choice (both accents ≥ AA against their backgrounds) and by the browser suite, which flips the
toggle and compares computed background colours. New hardcoded colours in components would break
the invariant invisibly — `lint:screens` and review have to keep holding the "tokens only" line.
