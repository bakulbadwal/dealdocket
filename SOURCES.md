# Sources: Deal Docket

This file covers every figure in `data.json` that is meant to describe the real world, says where it comes from, and says how far it was checked. Deals, companies and financials are **fictional on purpose** (see the disclaimer in the app) and are not listed here.

Sourcing pass: **15 October 2026**. All access dates below are that day.

---

## What was sourced, and what wasn't

The only real-world input in the model is `verticalContext[*].automatableCostShare`: the share of a vertical's revenue that is cost AI could plausibly absorb. It drives the AI-margin line of the roll-up value bridge.

| Vertical | Before | After | Basis | NAICS proxy |
|---|---:|---:|---|---|
| Bookkeeping & Accounting | 24% | **22%** | sourced | 5412 |
| IT Managed Services | 18% | **20%** | sourced | 5415 |
| Legal Back-Office | 26% | **19%** | sourced | 5411 |
| Marketing & Creative Agencies | 15% | 15% | **assumption** | (5418) |
| Home Services | 8% | 8% | **assumption** | (238220) |
| Staffing & Recruiting | 16% | 16% | **assumption** | (5613) |
| Medical Billing / RCM | 28% | 28% | **assumption** | (541219, inside 5412) |
| Logistics & Dispatch | 13% | 13% | **assumption** | (4885) |
| Customer Support / BPO | 32% | 32% | **assumption** | (5614 / 561422) |
| Property Management | 15% | 15% | **assumption** | (531) |

That's three verticals sourced, which is the pattern the roadmap asked for ("do three verticals fully, ship, then extend"). The other seven are labelled `"basis": "assumption"` in `data.json`, and the app says so in two places: next to the AI cost-capture slider in the roll-up builder, and in each deal's detail drawer.

**Firm counts are not in the data yet.** `firmCount` is still a roadmap item. Census County Business Patterns (CBP) and Statistics of U.S. Businesses (SUSB) tables couldn't be reached from the build environment (see "How this was verified" below). Search results only turned up third-party aggregators re-quoting CBP, and they disagreed with each other. I didn't put an unverified count into the data. The exact query to run is under "Still open".

---

## Method for the sourced figures

```
automatableCostShare = (payroll ÷ revenue) × (share of payroll in LLM-exposed tasks)
```

1. **Payroll ÷ revenue** comes from the U.S. Census Bureau's *Service Annual Survey* (SAS), 2022 reference year, for all employer establishments in the NAICS 4-digit industry. This is the last SAS vintage. From 2023 the Annual Integrated Economic Survey replaces it.
2. **Share of payroll in LLM-exposed tasks** takes the industry's national staffing pattern from BLS *Occupational Employment and Wage Statistics* (OEWS), May 2025: employment × mean annual wage for each detailed occupation. Each occupation's wage bill is then weighted by its GPT-exposure score (β) from Eloundou, Manning, Mishkin & Rock. β is the share of an occupation's tasks where an LLM, alone or with software built on it, can cut completion time by at least half. It counts direct exposure fully and tool-dependent exposure at one half. I used the paper's human-annotator β. O\*NET-SOC 8-digit codes were collapsed to 6-digit SOC using the `.00` code where one exists, and the mean of the sub-codes otherwise. Matched coverage is above 99% of each industry's detailed-occupation wage bill.

### Figures

| | 5412 Accounting, tax prep, bookkeeping, payroll | 5415 Computer systems design & related | 5411 Legal services |
|---|---:|---:|---:|
| Gross annual payroll, 2022 ($M) | 87,321 | 260,735 | 134,936 |
| Revenue, 2022 ($M) | 198,869 | 648,805 | 357,681 ¹ |
| **Payroll ÷ revenue** | **43.9%** | **40.2%** | **37.7%** |
| Wage-weighted exposure β (human rating) | **49.5%** | **50.5%** | **49.1%** |
| **Automatable cost share** | 21.7% → **22** | 20.3% → **20** | 18.5% → **19** |
| Sensitivity: β from the GPT-4 rating instead | 24.9% | 26.7% | 18.2% |
| Largest wage-bill occupations (OEWS May 2025) | Accountants & auditors 32%, financial managers 12%, bookkeeping clerks 5% | Software developers 24%, IT managers 9%, general/ops managers 5% | Lawyers 61%, paralegals 15%, legal secretaries 5% |

¹ Legal services revenue is the SAS series for establishments *subject to federal income tax*. I couldn't retrieve an all-establishments total for 5411. Tax-exempt legal establishments, such as legal aid, are a small share, so the true ratio is slightly lower than 37.7%.

### Caveats

- **NAICS 4-digit is a proxy for each vertical, not a match.**
  - 5415 is dominated by software development. A pure MSP has more support technicians, with β around 0.67 for computer user support specialists.
  - 5411 is dominated by lawyers. A legal-support vendor has more paralegals and secretaries, with β of 0.45 and 0.76.
  - 5412 is dominated by CPAs. A pure bookkeeping shop has more clerks, with β of 0.31.

  So the sourced figure describes the industry the vertical sits in, not the niche itself.
- **Payroll excludes benefits.** Employer fringe costs typically add around 20% to the labour bill, so the sourced shares lean conservative.
- **Exposure is not realised saving.** β says a task's time could be roughly halved. It does not say the cost goes away. The roll-up's **AI cost capture** slider (default 30%) and each asset's AI-leverage score already model realisation, so they are not double-counted here.
- **Years are mixed:** 2022 payroll and revenue, May 2025 staffing, and 2023–24 exposure scores. The ratio inputs move slowly. As a cross-check, OEWS May 2025 wage bills come out 5–16% above SAS 2022 payroll for the same industries (5412: $99.5B against $87.3B; 5415: $303.5B against $260.7B; 5411: $141.5B against $134.9B). That fits wage growth over the gap, so the two sources describe the same labour pool.
- **Legal Back-Office moved the most**, from 26% to 19%. The old estimate assumed a support-staff-heavy mix. On the sourced industry mix, lawyers (β 0.48) carry most of the payroll.

---

## Sources

1. **U.S. Census Bureau, Service Annual Survey, 2022 (employer firms, all establishments).** Accessed via FRED (Federal Reserve Bank of St. Louis), series last updated 31 January 2024.
   - Gross Annual Payroll, Accounting, Tax Preparation, Bookkeeping, and Payroll Services: [`EXPGAPEF5412ALLEST`](https://fred.stlouisfed.org/series/EXPGAPEF5412ALLEST). 2022 = 87,321 $M.
   - Revenue, Accounting, Tax Preparation, Bookkeeping, and Payroll Services: [`ATPBAPSRAEE45412`](https://fred.stlouisfed.org/series/ATPBAPSRAEE45412). 2022 = 198,869 $M.
   - Gross Annual Payroll, Computer Systems Design and Related Services: [`EXPGAPEF5415ALLEST`](https://fred.stlouisfed.org/series/EXPGAPEF5415ALLEST). 2022 = 260,735 $M.
   - Total Revenue, Computer Systems Design and Related Services: [`REVEF5415ALLEST`](https://fred.stlouisfed.org/series/REVEF5415ALLEST). 2022 = 648,805 $M.
   - Gross Annual Payroll, Legal Services: [`EXPGAPEF5411ALLEST`](https://fred.stlouisfed.org/series/EXPGAPEF5411ALLEST). 2022 = 134,936 $M.
   - Revenue, Legal Services, establishments subject to federal income tax: [`LSRESTFITEF45411`](https://fred.stlouisfed.org/series/LSRESTFITEF45411). 2022 = 357,681 $M.
   - Programme page: <https://www.census.gov/programs-surveys/sas.html>
2. **U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025, national industry-specific estimates** (released 15 May 2026). Industries 541100, 541200, 541500 (and, for the sanity checks below, 238220, 488500, 531000, 541800, 561300, 561400). Fields used: employment and annual mean wage by detailed SOC occupation. Source files: <https://download.bls.gov/pub/time.series/oe/> (`oe.data.0.Current`, `oe.industry`, `oe.occupation`). Tables: <https://www.bls.gov/oes/tables.htm>.
3. **Eloundou, T., Manning, S., Mishkin, P. & Rock, D. (2024). "GPTs are GPTs: Labor market impact potential of LLMs." *Science* 384(6702), 1306–1308.** doi:[10.1126/science.adj0998](https://doi.org/10.1126/science.adj0998). Working paper arXiv:2303.10130 (2023). Occupation-level scores: `data/occ_level.csv`, columns `human_rating_beta` and `dv_rating_beta`, from <https://github.com/openai/GPTs-are-GPTs> at commit `0471612f`.

### How this was verified

The build sandbox blocks census.gov, bls.gov and fred.stlouisfed.org, so none of these were fetched directly. Here's what was done for each:

- **SAS / FRED values.** Each of the six series values was retrieved through web-search results for the FRED series page in two separate queries, and both returned the same 2022 value along with the neighbouring years. They have **not** been checked against a downloaded FRED or Census file. Anyone with normal internet access can confirm them in about a minute from the series links above.
- **OEWS May 2025.** I read the industry-specific data from the BLS `oe` time-series files as repackaged in the PyPI package [`bls-oews-mcp` 1.1.4](https://pypi.org/project/bls-oews-mcp/). Its manifest records the source URL, BLS `Last-Modified` date (15 May 2026) and SHA-256 hash of each BLS file. The bundled database matched its manifest hash (`b5e75974…cec52`). As a spot check, the all-occupations national annual mean wage in that data, $69,770, matches the BLS May 2025 release. This is a third-party repackaging, verified for internal consistency and one headline figure, not file-for-file against bls.gov.
- **Eloundou et al.** I read the scores directly from the authors' public GitHub repository (`occ_level.csv`, SHA-256 `40c74f53…749acb`).

---

## The seven assumptions: what is and isn't known

For these verticals the exposure half of the formula can be sourced, because OEWS covers each industry, but I couldn't retrieve a citable payroll-to-revenue ratio. Dividing the author's estimate by the sourced exposure gives the payroll share the estimate implicitly assumes. That's a plausibility check, not a source.

| Vertical | Estimate | Proxy industry exposure β | Implied payroll ÷ revenue | Read |
|---|---:|---:|---:|---|
| Customer Support / BPO | 32% | 53.4% (5614) | ≈ 60% | Plausible for labour-heavy contact centres. SAS has 561422 revenue (2022: 22,618 $M, [`REVEF561422ALLEST`](https://fred.stlouisfed.org/series/REVEF561422ALLEST)) but no retrievable payroll series. |
| Medical Billing / RCM | 28% | 49.5% (5412) | ≈ 57% | Billing offices sit in 541219, inside 5412. Applying the 5412 inputs would give 22%, but the 5412 staffing mix is CPA-heavy, so I didn't substitute it. |
| Staffing & Recruiting | 16% | 34.4% (5613) | ≈ 47% | Revenue includes temp workers' pay, so a high payroll share is expected. Not cited. |
| Marketing & Creative Agencies | 15% | 52.9% (5418) | ≈ 28% | SAS 2022 payroll for 5418 is 51,319 $M ([`EXPGAPEF5418ALLEST`](https://fred.stlouisfed.org/series/EXPGAPEF5418ALLEST)), but I couldn't retrieve a 4-digit total-revenue series to pair with it. |
| Property Management | 15% | 37.8% (531) | ≈ 40% | OEWS only publishes 531 (all real estate), which is broader than property management. |
| Logistics & Dispatch | 13% | 42.7% (4885) | ≈ 30% | **Probably high** for brokerage-style firms. 4885 revenue includes purchased transportation: SAS 2022 revenue is 252,417 $M ([`REVEF4885ALLEST`](https://fred.stlouisfed.org/series/REVEF4885ALLEST)) against an OEWS 2025 wage bill of about $17B. That rough, mixed-year check points to roughly 3–4%. It stays as labelled because the vertical also includes asset-based last-mile operators. |
| Home Services | 8% | 21.0% (238220) | ≈ 38% | Technicians dominate payroll and have low exposure (plumbers β 0.06, HVAC 0.14). Construction is outside SAS, so the ratio needs the 2022 Economic Census. |

---

## Still open

- **Payroll ÷ revenue for the seven assumed verticals.** These need the SAS 2022 series (`EXPGAPEF<naics>ALLEST`, `REVEF<naics>ALLEST`) or, for 238220, the 2022 Economic Census.
- **Firm counts (`firmCount`).** The Census CBP 2023 national query is
  `https://api.census.gov/data/2023/cbp?get=NAICS2017,NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=us:*&NAICS2017=<code>`.
  The codes are 541512/541513/541519, 5412, 541810, 238220, 5613, 541199, 541219, 488510, 561422 and 531311. SUSB 2022 (`us_state_6digitnaics_2022`) adds *firm*, not just establishment, counts.
- **`marginRange` and `consolidationActivity`** from the roadmap have not been started.
