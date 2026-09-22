---
target: karina-salgado-site (5 páginas)
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
target_identity: "file:/home/user/coder/karina-salgado-site/index.html"
target_fingerprint: "sha256:2090a5389825cd745f6e3d1c71d59250b10a20c0e4795bcdf2db5d53bd9e172e"
target_path: /home/user/coder/karina-salgado-site/index.html
timestamp: 2026-09-22T14-48-50Z
slug: karina-salgado-site-index-html
---
Método: DEGRADADO: contexto único (sem autorização explícita para subagentes nesta sessão)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Form submit gives no on-page confirmation (mailto: only) |
| 2 | Match System/Real World | 3 | Natural Portuguese, no jargon |
| 3 | User Control and Freedom | 3 | Mobile nav closes on link click; no traps |
| 4 | Consistency and Standards | 4 | Header/footer/cards identical across pages |
| 5 | Error Prevention | 2 | Native HTML5 validation only, no inline hints |
| 6 | Recognition Rather Than Recall | 3 | Text nav labels, shallow 5-page structure |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode landing site |
| 8 | Aesthetic and Minimalist Design | 2 | Contact form breaks on mobile; repeated generic hero-eyebrow pattern |
| 9 | Error Recovery | 1 | Silent mailto: failure with no mail client configured |
| 10 | Help and Documentation | n/a | Persuade-mode landing site |
| Total | | 20/32 | Acceptable (62%) |

## Design Specificity Verdict
LLM: Overall composition (white bg, Cormorant Garamond + Inter, generous whitespace) reads authored for a boutique dental brand. Detector flagged an identical hero-eyebrow-chip pattern repeated on all 5 pages -- the #1 generic AI-SaaS hero cliche -- as the main thing undermining specificity.
Deterministic scan: 32 findings, all severity=warning, across 5 files. Two probable false positives: all-caps-body (likely counting concatenated short .eyebrow labels, not a real long uppercase passage) and part of cramped-padding (intentional hairline-divider grid technique).
Visual overlays: not attempted (no live-server/browser injection infra set up this session); static desktop+mobile screenshots used instead as fallback evidence.

## Overall Impression
Visual direction matches the brief well. The real problem is functional, not aesthetic: the site's only conversion path (the contact form) is broken on mobile (layout) and fails silently on submit (mailto: with no mail client) -- the two biggest levers for an actual local-clinic lead.

## What's Working
- Full consistency across all 5 pages (header, footer, cards, buttons)
- Clear typographic hierarchy (Cormorant Garamond headings)
- Real client photos integrated cleanly via object-fit: cover

## Priority Issues

[P0] Mobile-breaking contact form
Why it matters: .footer-grid never gets a mobile breakpoint, so the contact form + map columns stay side-by-side at 390px, squeezing form fields into a ~140px column -- the site's primary CTA is nearly unusable on phones, the majority of a local clinic's traffic.
Fix: add grid-template-columns: 1fr for .footer-grid inside the existing mobile breakpoint.
Suggested command: $impeccable adapt

[P0] Silent mailto: form failure
Why it matters: Submit only triggers mailto:; in-app browsers (Instagram/WhatsApp) or phones without a configured mail app -- common -- make the click do nothing visible. Visitor believes the message sent; it never arrives.
Fix: replace with a real form backend (Web3Forms/Formspree) with on-page confirmation.
Suggested command: $impeccable harden

[P1] Identical hero-eyebrow-chip repeated on all 5 pages
Why it matters: flagged 5x by the detector as the #1 generic AI-SaaS hero cliche; undermines the authored-brand feeling the rest of the site earns.
Fix: vary treatment per page or integrate the kicker into the heading itself.
Suggested command: $impeccable distill

[P1] Footer logo tagline below legibility floor
Why it matters: "KARINA SALGADO" under the KS mark renders at 9.6px, below the 11px functional-text floor; hard to read on small/high-DPI screens.
Fix: raise to >=11px, adjust letter-spacing to preserve proportion.
Suggested command: $impeccable harden

## Persona Red Flags
Casey (distracted mobile user): hits both P0s back to back -- cramped form fields, then a submit that may silently do nothing.
Jordan (first-timer/parent): plain-language nav builds trust, but the Formacao list still shows "-" placeholders for years, reading as missing info rather than in-progress if shipped live.
Riley (stress tester): reload mid-form loses all input with no warning; mailto without a mail client returns total silence.

## Minor Observations
- Inter flagged 5x by detector as an overused font; functional but not distinctive for a "luxo" brief.
- 4 skipped heading levels (h1 -> h3, no h2) hurt screen-reader navigation.
- cramped-padding flagged 9x; partly the intentional hairline-divider grid technique, worth a manual pass to confirm which are accidental.

## Questions to Consider
- Should the contact form stay mailto: as a stopgap, or move to Web3Forms/Formspree now, ahead of the other client data arriving?
- Was the eyebrow-above-title pattern part of the client's brief, or a styling choice worth reconsidering?
