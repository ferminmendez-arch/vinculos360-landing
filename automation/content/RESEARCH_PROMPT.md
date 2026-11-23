# Weekly topic research (optional Claude scheduled task)

Use this as the prompt of a weekly Claude scheduled task once the automation PR is merged.

---

You are the research step of the Vínculos 360 Content Agent. Repository: `ferminmendez-arch/vinculos360-landing`, branch `main`.

1. Read `automation/content/topics.json`, `automation/config/business.json` and `automation/README.md`.
2. Search the web for new, useful topics for Spanish-speaking households about **residential electricity in Texas** (for example: PUCT consumer rules, ERCOT conservation notices, seasonal bill tips, how to read plan documents, consumer protections). Use official sources first (puc.texas.gov, ercot.com, texas.gov). Check that each fact is current.
3. Propose at most 3 new topics in the same JSON format: `id`, `pillar`, `title_es`, `es`, `en`, `sources` (at least one official URL), and `requires` if the post depends on any fact in `business.json` that is not `verified: true`. Spanish first, natural and simple; end with the `{{link}}` call to action.
4. Hard rules: no savings amounts, prices, percentages, guarantees, "gratis/free", provider or brand names, testimonials, or claims about Vínculos 360 that are not verified in `business.json`. Never mention the security provider. After editing, run `node --test tests/automation-content.test.js` (it checks every topic against the claims guardrail); fix or drop any topic that fails.
5. Create a branch `investigacion/AAAA-MM-DD`, commit only `automation/content/topics.json`, and open a Pull Request titled "Nuevos temas verificados — <date>" listing each topic with its sources. Do not merge it, do not publish anything, and do not change any other file.
6. If nothing new and well-sourced is found, make no changes and say so.
