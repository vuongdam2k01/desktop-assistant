## MODIFIED Requirements

### Requirement: The job detail page carries the full account of one job

The job detail page SHALL show the original request including any attached images, the result summary, the
ledger in its readable form, the undo and cancel actions appropriate to the job's state, and what the job
consumed — the token counts recorded for it, broken down by the role each request served, together with the cost
computed from the unit prices the user configured or, where no unit price is configured for a model the job
used, a statement that no cost is available for that model.

Source: `docs/raw-idea/prd-mvp.md#10-7-module-cua-so-app-app` (FR-APP-03) — UNVERIFIED for the original
content. The usage and cost display is added here and is VERIFIED as the remedy for a user being surprised by
their own provider bill (`spikes/SP-17-provider-matrix/REPORT.md#3-dau-vao-cho-tai-lieu-ky-thuat` item 3,
`spikes/SP-17-provider-matrix/REPORT.md#1-tra-loi-tung-cau-hoi` Q6). That the price is the user's own rather
than one the product ships was decided in `clarifications.md` session 2026-09-12: a shipped price table is a
claim about a third party's commercial terms that goes stale without the user being able to see that it has.

#### Scenario: Actions match the state
- **GIVEN** a job is running
- **WHEN** its detail page is open
- **THEN** cancel is offered and undo is not, because the job has not finished

#### Scenario: Undo of an undo job
- **GIVEN** the job being viewed is itself an undo job
- **WHEN** its detail page is open
- **THEN** it links to the job it undid and its own ledger is shown

#### Scenario: A job that used several roles
- **GIVEN** a completed job used the pet text, worker and risk judge roles
- **WHEN** its detail page is open
- **THEN** the token counts are shown per role and as a total for the job

#### Scenario: No unit price is configured
- **GIVEN** the user has configured no unit prices for the model the worker role used
- **WHEN** the job detail page is open
- **THEN** the token counts are shown and the page states that no cost is available for that model, and no
  figure derived from any other price is shown

#### Scenario: A running job
- **GIVEN** a job is still running
- **WHEN** its detail page is open
- **THEN** the usage recorded so far is shown and marked as incomplete, rather than being withheld until the job
  ends

#### Scenario: The provider reported no usage
- **GIVEN** a request in the job returned without usage figures
- **WHEN** the job detail page is open
- **THEN** that request is shown as usage not reported, and it is not counted as zero tokens in the job total
