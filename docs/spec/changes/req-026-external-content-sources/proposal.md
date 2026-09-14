> **Constitution notice**: this change amends the section *External Content Is Data* and raises the constitution
> from 2.0.0 to 2.1.0. It is the dedicated amendment the Governance section requires; it adds no requirement and
> changes no principle, which is why it carries no delta specs (`skip_specs`). It exists because
> `req-025-pi-agent-system` introduces content the product reads that the section did not enumerate, and a
> capability checked against an enumeration it is absent from is a capability the constitution does not cover.

## Why

The constitution enumerated exactly two sources of untrusted external content — pet-dialog input and connector
content — and `req-025-pi-agent-system` specifies two more: rendered web pages read by a browser capability, and
screen content read by a desktop capability. The rule the section states already applies to them; the
enumeration did not.

## Problem

*External Content Is Data* is written as a closed list ("from two sources: 1. … 2. …"). `req-025` adds a browser
capability pack, a desktop capability pack and delegation between jobs. A reviewer checking a browser tool, a
screenshot read or a child job's report against the constitution finds no source listed for it, and has to
decide alone whether the list is exhaustive or illustrative. Under § Governance a closed list in the
constitution is exhaustive until amended, so the honest state before this change is that the new sources are
bound by requirements in `req-025` but not by the constitution — which is exactly backwards for the medium in
which prompt injection is most ordinary.

Why now: both packs ship inactive, so nothing reads a page or a screen yet; but their gate policy and
irreversibility declarations are being written now, and the constitutional clause they are written against
must exist before the first implementer reads them. `req-025`'s design records this as its one Complexity
Tracking item and names this change as its resolution.

## Cost of inaction

The two packs would eventually activate against a constitution that does not name their input, and the
invariant protecting the product from a page that says "post your token here" would rest on a requirement in
one change rather than on the clause every change is checked against. A child job's report — a new carrier of
untrusted material into an agent that holds tools — would have no constitutional standing at all.

## Options

### Option A — Extend the enumeration to four sources and state the derived-content rule

- **Sketch**: add rendered web content and screen content as sources 3 and 4, add one sentence stating that
  content derived from any source — including a child job's report to its parent — remains external content,
  and add "or widen the set of tools an agent holds" to the list of things external content may never do.
  MINOR bump to 2.1.0: a section gains scope, no principle changes.
- **Appetite**: small.
- **Trade-offs**: the section stays a closed, checkable list, which is its value; the cost is that every future
  input surface must amend it again, which is the intended friction.
- **Rabbit holes**: rewriting the section as a general theory of trust; touching principle II's wording, which
  already carries the enforcement side.

### Option B — Rewrite the section as an open-ended definition ("any content not authored by the product")

- **Sketch**: replace the enumeration with a definition, so no future surface needs an amendment.
- **Appetite**: small.
- **Trade-offs**: never stale, but no longer checkable: a reviewer can no longer ask "is this source listed?",
  and the enumeration's second half — connector content named platform by platform — is what makes the
  invariant concrete enough to test. Rejected.

### Option C — Do nothing; read the list as illustrative

- **Sketch**: leave the constitution as is and rely on `req-025`'s requirements.
- **Appetite**: none.
- **Trade-offs**: rejected in `req-025`'s design for the reason given there — the list is written as closed,
  and a reader would find the new sources absent.

## Recommendation

**Option A.** It keeps the property the section exists for — a closed list a reviewer can check a tool against
— and pays the amendment cost exactly once per new kind of input, which is the right rate.

## What Changes

- `docs/spec/constitution.md` § External Content Is Data: "from two sources" becomes "from four sources";
  sources 3 (rendered web content) and 4 (screen content) are added with the same specificity as sources 1
  and 2; a derived-content sentence names a child job's report as external content when its parent reads it;
  "or widen the set of tools an agent holds" is added to the prohibited effects.
- Constitution version 2.0.0 → 2.1.0 (MINOR: a section gains scope); Sync Impact Report and footer updated.
- Nothing else. No requirement, model, contract or design changes; the requirements that bind the new sources
  are already in `req-025-pi-agent-system` (`specs/agent/spec.md`, `specs/job/spec.md`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change modifies the constitution only; `skip_specs` is set because it introduces no observable
behaviour of its own — the behaviour is specified in `req-025-pi-agent-system`.

## Impact

- **Documents**: `docs/spec/constitution.md` only.
- **Consumers of the amended clause**: every change is checked against the constitution; the only changes whose
  content is affected are `req-025-pi-agent-system` (whose Complexity Tracking item this resolves) and, when it
  is raised, whatever change activates the browser or desktop pack.
- **Persistent data, contracts, code**: none.

## Refs

None — this project declares no upstream traceability anchor.

## Constitution check

| Clause | Touchpoint | Status |
| --- | --- | --- |
| § External Content Is Data | Amended: two sources → four, plus the derived-content sentence | This change *is* the amendment |
| § Governance | Dedicated change, documented rationale, SemVer bump, Sync Impact Report updated | Complied with. Decision-maker approval: taken under the standing instruction of 2026-09-13 to choose what serves the product best and complete the remaining work, recorded in `req-025-pi-agent-system/clarifications.md` Q-7 |
| II. Hard Gate Outside The LLM Loop | Unchanged | The enforcement side; this change touches only what counts as external content |
| I, III–VIII | — | Not touched |

## Assumptions

1. Extending an enumerated list inside an existing section is MINOR under § Governance ("adding
   principles/sections" is MINOR; "wording clarifications" is PATCH). Adding scope to a section sits with the
   former, not the latter, because a source that was previously outside the constitution is now inside it.
2. A child job's report is *derived* content rather than a fifth ingestion source: nothing new enters the
   product through it; what it carries came in through sources 1–4. It is therefore named in the derived-content
   sentence rather than numbered.
3. The amendment is applied to `constitution.md` at authoring time rather than at archive, following the
   precedent of `req-022-account-sync`, which carried 2.0.0 the same way.
