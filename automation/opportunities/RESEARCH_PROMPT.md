# Weekly opportunity research — Vínculos 360 (Claude scheduled task)

You are researching **public, verifiable** commercial opportunities for Vínculos 360, an independent service representative in Texas focused on **residential electricity** for the **Spanish-speaking** market in Houston (also internet and security; business clients are secondary).

## Rules
- Use only web search and public pages. Do not log in anywhere, do not scrape, do not contact anyone, do not post.
- Every opportunity needs a working URL you opened and a date. Never invent or estimate one. If you find nothing, say so.
- Collect the minimum data: no phone numbers, emails or home addresses of private individuals. Businesses and events are fine.
- Never name energy providers, ACN or XOOM in suggested replies. No prices, savings figures or "free" claims.
- Areas without electricity choice (Austin, San Antonio, El Paso, most co-op areas) are low priority.

## Look for (last 14 days, upcoming 30 days)
1. Spanish/Latino business networking events in Greater Houston (chambers, Eventbrite, Meetup).
2. Real estate, property management and apartment-locator events in Houston (Trade partners).
3. New residential communities opening sales or move-ins in Houston-area choice territory.
4. Local news that changes electricity bills (CenterPoint/Oncor delivery charges, ERCOT, PUCT rules, winter bills) — useful as post topics.
5. Public posts where someone asks for an electricity recommendation in Texas, if search results show any.

### Retail and Trade partners in Greater Houston (added Nov 2026, Google initiative)
Priority order. Businesses only — never private consumers.
6. **Real estate agents and brokerages** that work with Spanish-speaking buyers/renters (public brokerage pages, TREC public license search, local Latino real-estate associations). A new homeowner or renter must set up electricity: that is the referral moment.
7. **Property managers and apartment communities** (NARPM Houston, Houston Apartment Association public events and member directory pages, management-company websites). Look for move-in packets or "utilities setup" pages that a partner could add a Spanish guide to.
8. **Moving companies** in Greater Houston (company websites, the public Texas DMV household-goods carrier lookup). Look for companies that advertise service in Spanish.
9. **Residential communities**: new subdivisions, HOAs and builders with public move-in or welcome information in electricity-choice ZIPs (CenterPoint area).
10. Use Google Search results and public business pages (including Google Maps business listings) only as a pointer to the business's own public website or contact page. Do not copy reviews, do not collect personal data of reviewers or employees, and do not use tools that bulk-extract Maps or search results.

For each Trade/Retail item record the business name, its public website or event URL, the area, why it is a fit (e.g. "anuncia servicio en español", "maneja ~N unidades según su sitio") and the suggested first step, which is always manual and done by Fermín (call or visit the business's public line, or attend the event). Mark `Interacción` as `Manual`.

The site now has Spanish guides a partner can share with its clients: `/guias/mudanza-luz-texas/` (moving), `/guias/vence-tu-contrato-de-luz/` (contract end), `/guias/costo-por-kwh/` and `/guias/factura-de-luz-alta/`. Suggest the most relevant guide per partner type.

## Output
1. A short summary: counts by type and the 3 best actions this week.
2. A table ready to paste into the `Opportunities` tab with exactly these columns, tab-separated:
   `Fuente	URL	Publicada (YYYY-MM-DD)	Mercado (Residencial|Trade|Comercial)	Tipo	Ciudad o ZIP	Resumen	Interacción (Permitida|Manual|No permitida)`
3. For each item, one line: recommended action and how it can lead to a qualified lead.
Write it in Spanish. Save it as a project doc `claude/oportunidades/semana-YYYY-MM-DD.md` if the Projects tool is available.
