# Roadmap — Deal Docket

What this tool doesn't do yet, why, and what it would take. Kept in the repo rather than in my head, because the decision *not* to build something is usually more interesting than a feature list.

Status: **July 2026.** Forward-looking only — shipped work is in the [commit history](https://github.com/bakulbadwal/dealdocket/commits/main).

---

## The known soft spot: unsourced automatable-cost estimates

**This is the honest weakness in the current build, and it's deliberate.**

The roll-up builder's AI margin uplift is driven by a per-vertical `automatableCostShare` — the share of revenue representing cost that AI could plausibly absorb. Bookkeeping is set at 24%, home services at 8%, customer support at 32%, and so on.

**Those numbers are my estimates, not researched figures.** Each is tagged `"basis": "estimate"` in `data.json` with `source: null` and `asOf: null`, so the data never pretends otherwise. Being transparent about the model's weakest input is the minimum bar — it isn't the same as being right.

### What "done" looks like

Replace each estimate with a sourced, dated figure and flip `basis` to `"sourced"`:

| Field | What it needs |
|---|---|
| `automatableCostShare` | A defensible labour-cost decomposition per vertical, cited, with an `asOf` date |
| `firmCount` / fragmentation | US establishment counts — Census County Business Patterns is the obvious spine |
| `marginRange` | Observed EBITDA margin bands for the vertical, not assumed |
| `consolidationActivity` | Actual sponsor platform/add-on activity — evidence the roll-up is already happening, or isn't |

Ten verticals × four fields, each cited. That's research, not a coding task, which is exactly why it hasn't happened in a build session.

### Why it's deferred rather than dropped

The estimates are directionally defensible and the model is explicit about them. Sourcing them properly would make the tool's central claim *evidentiary* rather than *illustrative* — a real upgrade — but it doesn't change the architecture, and the value bridge is arithmetically sound regardless of which numbers go in. Correctness of structure first; correctness of inputs second.

**First step if picked up:** do three verticals fully as the pattern, ship, then extend. Don't attempt ten in one sitting.

### The unlock it enables

Once vertical context is real, a **vertical × criterion heatmap** becomes worth building — showing where the thesis is structurally strongest rather than where this particular sample of 30 deals happens to score well. Right now the tool can only tell you about its own data.

---

## Deferred features, in rough priority order

### 1. Sensitivity on the *financial* assumptions, not just the weights

Rank stability already answers "how much does the ranking depend on my weights." The roll-up builder has no equivalent. Exit multiple, capture rate and organic growth are single-point inputs, and MOIC is quoted to two decimals off them — which overstates precision.

A distribution over those three inputs, producing a MOIC *range* rather than a point estimate, would make the roll-up as epistemically honest as the screen already is. **Highest-value item on this list**, because it fixes an inconsistency in the tool's own standards.

### 2. Leverage

The roll-up model is all-equity and says so. Real roll-ups are debt-financed, and leverage is a large share of sponsor returns — so the current MOIC understates what the strategy produces while overstating how safe it is. A debt tranche with a coverage constraint would be more realistic, at the cost of a materially more complex model and several more assumptions to defend.

Deliberately not built yet: the multiple-arbitrage-vs-AI-margin split is the *point* of the current view, and leverage would blur it.

### 3. Integration cost and failure

Every add-on currently combines at zero cost and 100% success. That's the optimistic case — flagged in the UI caveat, but not modelled. A per-add-on integration cost and a failure probability would make the bridge honest about downside.

### 4. Scenario save and compare

URL state makes a specific view shareable. It doesn't make two views comparable side by side. Saving named scenarios ("base", "AI disappoints", "multiple compression") and diffing them is the natural next step, and pairs well with item 1.

### 5. Editable deals

The pipeline is read-only. Letting a user add or edit a deal in-browser — persisted to `localStorage`, exportable as JSON — would turn a demo into something usable on a real pipeline without needing a backend.

### 6. Export

CSV of the current filtered and ranked view, plus a print stylesheet for the roll-up. Cheap, and the kind of thing that makes a tool get used rather than admired.

---

## Explicitly not doing

- **A backend.** Flat JSON is correct for a single-author static artifact. Moving to Postgres/Supabase is justified the moment there are live edits, multiple users, or auth — not before. Building infrastructure for a problem you don't have is a common and expensive mistake.
- **Real company data.** The deals are fictional on purpose, and a public portfolio piece is the wrong place for real target data.
- **More deals.** Thirty is enough to demonstrate the framework. A hundred would be slower and no more convincing — the constraint here has never been sample size.
- **A second scoring framework.** One opinionated thesis, argued properly, beats a configurable meta-tool that believes nothing.

---

## Design constraints to preserve

Anything built from here should hold these, because they're what makes the tool coherent:

1. **No dependencies, no build step.** It stays a static site that runs from a folder.
2. **Assumptions stay visible and adjustable.** The premise is that a screen's weights are an argument, not a fact. Any new model input follows the same rule — expose it, don't bury it.
3. **The tool states its own limitations in the UI**, not only in the docs. The all-equity caveat sits next to the MOIC for a reason.
4. **Data and view stay separate.** Content that goes stale lives in `data.json`.
