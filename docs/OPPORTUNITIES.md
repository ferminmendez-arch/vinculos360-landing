# Opportunity Discovery Agent (Agente de oportunidades)

Purpose: find **real, public, verifiable** commercial signals and turn them into **qualified leads**, with Texas residential electricity first and the Spanish-speaking market prioritized.

An *opportunity* is a public signal. It is **not** a lead. It becomes a lead only when the person leaves their data on the website **with consent** (chat or form). It becomes a *qualified lead* only when a person confirms it in **Seguimiento**.

| Stage | Where it lives | Who moves it |
| --- | --- | --- |
| Opportunity (signal) | `Opportunities` tab | Agent (adds and scores) or owner (pastes) |
| Prospect (contacted) | `Opportunities` → Estado `Contactada` / `Respondió` | Owner |
| Lead (data + consent) | `Leads` tab (receiver) | Visitor, via site/chat |
| Qualified lead | `Seguimiento` → Estado `Calificado` | Owner |
| Customer | `Seguimiento` → `Inscrito` / `Cliente` | Owner |

## Components

| Part | Runs where | When | Cost |
| --- | --- | --- | --- |
| `automation/apps-script/OpportunityAgent.js` — enrich, score, dedupe, TREC trade source, link to leads, `Embudo` dashboard | Apps Script project **Vinculos 365** (same as `LeadAgent.js`), owner's Google account | Daily 6 a.m. Houston | $0 |
| `sendDailyBrief` — email brief | Same project | Daily 7 a.m. Houston | $0 |
| Claude research task (events, new communities, news) — `automation/opportunities/RESEARCH_PROMPT.md` | Claude scheduled task (cloud) | Weekly | Included in the Claude plan |
| Manual review (Facebook groups, Nextdoor, HAR) | Owner | Listed in each daily brief | Owner time |

Nothing here scrapes, logs into social networks, posts, comments or sends messages. Reply texts are **drafts** for a person to review and post.

## Scoring (0–100)

Intent 35 · Service relevance 25 · Location/eligibility 20 · Recency 10 · Authorized interaction 10. Grades: **A ≥ 80**, **B 60–79**, **C < 60** (script properties `OPP_GRADE_A`, `OPP_GRADE_B`). Areas without choice (Austin, San Antonio, El Paso) or outside Texas are always **C** and get no reply draft. To recalculate a row, clear its `Score` cell. Review the weights after the first 30 days against which grades actually converted.

## Attribution

Every draft links to `https://www.vinculos360.com/?utm_source=<source>&utm_medium=oportunidad&utm_campaign=opportunity-agent&utm_content=<Opportunity ID>#analizador`. When a lead arrives with that `utm_content`, the agent fills `Lead ID` and sets the opportunity to *Convertida en lead*. Test rows never convert an opportunity.

## Sources evaluated (Nov 27, 2026)

| Source | Status | Why |
| --- | --- | --- |
| Facebook groups | **Manual only** | Meta removed third-party Groups API access in April 2024 (Graph API v19). Reading or posting in groups by automation is not allowed. |
| Facebook Page | Automated (existing publisher) | Pages API for the owner's own page only. |
| Reddit | **Manual only** | Data API free tier is non-commercial; commercial use needs a negotiated agreement. |
| Nextdoor | **Manual only** | Search/Publish APIs require partner approval. |
| Google Custom Search API | Not usable | Closed to new customers; ends Jan 1, 2027. |
| Brave Search API | Not used | No free plan since Feb 2026 (credit card + metered). |
| TREC license data (data.texas.gov) | **Automated, free** | Official open data, public Socrata API, no key. Used for Trade (new agents in Harris, Fort Bend, Montgomery, Brazoria, Galveston). Contains no phone or email. |
| Event listings, builder press releases, local news | Claude weekly research | Public web pages, read by Claude's web search; findings pasted to the sheet by the owner. |
| HAR.com, Craigslist | **Manual only** | Their terms prohibit scraping. |

## Install (owner approval required — production change)

1. In the Apps Script project **Vinculos 365**: **+ → Script**, name it `OpportunityAgent`, paste `automation/apps-script/OpportunityAgent.js`.
2. Replace `Code.gs` (LeadAgent) with the version from the same commit (adds `LeadId` reading).
3. Project Settings → `appsscript.json`: add the scope `https://www.googleapis.com/auth/script.external_request` (needed to read TREC open data).
4. Run `runOpportunitySelfTest`, then `setupOpportunities` and accept the new permission.
5. Optional properties: `OPP_TREC_ENABLED` (`true`), `OPP_TREC_DAILY_MAX` (5), `OPP_TREC_NEW_DAYS` (45), `OPP_GRADE_A`, `OPP_GRADE_B`.

## Rollback

- Stop: delete the `discoverOpportunities` and `sendDailyBrief` triggers (Apps Script → Triggers). Nothing else depends on them.
- Remove: delete the `OpportunityAgent` file. The `Opportunities` and `Embudo` tabs can stay or be deleted; `Leads`, `Seguimiento` and `Panel` are not modified by this agent.
- TREC only: set `OPP_TREC_ENABLED=false`.

## Tests

`node --test tests/automation-opportunities.test.js` (18 tests, synthetic data, mocked Google services and TREC API).
