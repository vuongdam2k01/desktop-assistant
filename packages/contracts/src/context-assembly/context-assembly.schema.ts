/**
 * Normative shape of the account that one model request's assembled context keeps of its own construction, for agent/contracts/context-assembly@1.0.0. The assembled context itself is memory only and is never an artifact; this document is what is recorded against the job, replicated with it, and read back when a run has to be explained (INV-AG-37). Three things the assembly guarantees are made structural here rather than left to prose. The seven declared sources are the seven members of 'sections', all required and nothing else admitted, each carrying the fixed ordinal that is its place in the declared order - so a context assembled from six sources, or in another order, has no valid account. A reduction can name only a section the ladder is allowed to act on and only an element kind the ladder is allowed to remove, so the protected set has no representable target. And an input bound into a template is one the template declared, so a render with an undeclared input - which fails, and produces no section - has no valid account either. What this file cannot check is stated by the contract document: that the recorded reductions ran in ladder order, that a bound input's name occurs in declaredInputs, and that a token count taken by the composer matches the provider's. No threshold here is fixed by this file: the reserve fraction and the retained-tail size are UNVERIFIED and await the measurement proposed as SP-23 in design.md R1.
 */
export type AssembledContextAccount = {
  /**
   * The version of the context-assembly contract this account was written against. The account travels with the job record and therefore replicates between devices on different builds: a newer build reads an older account unchanged, and an older build meeting a newer version refuses the account whole (ACCOUNT_VERSION_AHEAD) rather than reading around a member it does not recognise, because an unread reduction entry is a claim about what the model saw that nobody can check.
   */
  accountVersion: string;
  /**
   * The job this context was assembled for. One job's context holds nothing from any other job, so this identifier is also the whole of the account's scope.
   */
  jobId: string;
  /**
   * Which model request of this job the context was built for, counting from one. A job produces one account per request, so the job identifier and this ordinal together name exactly one assembly.
   */
  requestOrdinal: number;
  /**
   * The role registry identifier the agent runs under. Recorded because the role supplies the first section and names the tier the budget was derived through, and because a job whose role changed halfway would be a job whose account cannot be read - which is why a running job's model does not change (design.md D5).
   */
  roleId: string;
  /**
   * How much of the assigned model's declared window this job may spend, and how that figure was arrived at. Recorded when the job starts. The reserve fraction that turns a window into a ceiling and a reserve is a provisional declared default - 20% of the ceiling, never below 8 000 tokens, with a 32 000-token fallback ceiling when no window is declared - UNVERIFIED, and design.md R1 proposes SP-23 to measure it.
   */
  budget: {
    /**
     * Every figure in this account is a token count. The count is the composer's own, taken before the request is sent; the provider's count is the authoritative one and may differ, which is one of the reasons a reserve exists at all rather than the ceiling being the window itself.
     */
    unit: "tokens";
    /**
     * How the ceiling was arrived at. 'model-window' means it was derived from the context window the assigned model's provider profile declares, and modelWindowTokens records that window. 'declared-fallback' means the profile declared no window, so the product used its declared fallback budget - recorded here AS a fallback rather than dressed up as a derived figure, because a reader comparing two runs needs to know which of them was guessing.
     */
    derivation: "model-window" | "declared-fallback";
    /**
     * The context window the assigned model's provider profile declares. Required when derivation is 'model-window' and forbidden otherwise, so a fallback can never be recorded as though a window had been read.
     */
    modelWindowTokens?: number;
    /**
     * The whole of what this job may spend on one request. A job does not start when its first assembled context already exceeds it.
     */
    ceilingTokens: number;
    /**
     * Headroom held back inside the ceiling for the turn that follows. Reduction begins when the assembled context plus the expected next turn crosses it. The size of the reserve is a provisional declared default - 20% of the ceiling, never below 8 000 tokens - UNVERIFIED, pending SP-23.
     */
    reserveTokens: number;
  };
  /**
   * The seven declared context sources, all seven always present. The set is closed: an eighth source is a MAJOR revision of this contract, because a new place for material to come from is a new place external content can enter. Each member carries the fixed ordinal that is its place in the declared order, so the order is a property of the source rather than of how the account happened to be written. A source that was present and empty has a section of zero tokens; a source that could not be read stops the job instead (CONTEXT_SOURCE_UNAVAILABLE), so absence never has to be distinguished from emptiness here.
   */
  sections: {
    /**
     * 1. The role's durable instructions, from its registry entry. Not reducible: an agent whose identity was summarised is a different agent.
     */
    "role-instructions": {
      /**
       * First in the declared order.
       */
      ordinal: 1;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may not act on this section.
       */
      reducible: false;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template.
       */
      renderedFromTemplate?: string;
    };
    /**
     * 2. The instant every relative date resolves against, in the shape agent/contracts/worker-loop@0.1.0 already requires (worker-loop.prompt-context.schema.json). Protected: its absence is what produced the boundary-day errors of case S-16 - VERIFIED (spikes/SP-4-agent-loop/REPORT.md section 1 Q1).
     */
    "temporal-anchor": {
      /**
       * Second in the declared order.
       */
      ordinal: 2;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may not act on this section.
       */
      reducible: false;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template.
       */
      renderedFromTemplate?: string;
    };
    /**
     * 3. The tools this session holds, resolved once from the role's allowlist and frozen for the life of the session (INV-AG-33). Protected: an agent that has lost the list of what it can do reports completion it never performed.
     */
    "tool-set": {
      /**
       * Third in the declared order.
       */
      ordinal: 3;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may not act on this section.
       */
      reducible: false;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template.
       */
      renderedFromTemplate?: string;
    };
    /**
     * 4. The account's rules, rendered as advisory text. Advisory is the whole of it: enforcement is the gate's, in the application layer, where no model output reaches it (constitution principle II). Not reducible, because a half-present rule set reads as a complete one.
     */
    "account-rules": {
      /**
       * Fourth in the declared order.
       */
      ordinal: 4;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may not act on this section.
       */
      reducible: false;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template.
       */
      renderedFromTemplate?: string;
    };
    /**
     * 5. The bodies of the skills this job loaded, listed individually in skillsLoaded. Not reducible: a playbook missing the part the job had not reached yet is a playbook that misleads. A body is released when the job reaches a terminal state, not by the ladder.
     */
    "loaded-skills": {
      /**
       * Fifth in the declared order.
       */
      ordinal: 5;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may not act on this section.
       */
      reducible: false;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template.
       */
      renderedFromTemplate?: string;
    };
    /**
     * 6. What the user asked for, and what they dropped in with it. Reducible in one direction only: an attachment no longer in use may be replaced by a reference to its ledger record. The command itself and an attachment still in use are protected, and neither has a representable elementKind in a reduction entry.
     */
    "command-and-attachments": {
      /**
       * Sixth in the declared order.
       */
      ordinal: 6;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may act on this section, within the limits its element kinds allow.
       */
      reducible: true;
      /**
       * The templateId of the entry in templatesRendered that produced this section. The command and every attachment enter it as bound inputs carrying their origin, never as part of the template's own instruction text (INV-AG-39).
       */
      renderedFromTemplate?: string;
      /**
       * What the ladder was forbidden to touch inside this section on this request.
       *
       * Items: One protected element of this section: the job's command, and an attachment still in use.
       */
      protectedElements?: ("command" | "attachment-in-use")[];
    };
    /**
     * 7. The job's own turns and tool results, each result in the envelope agent/contracts/worker-loop@0.1.0 requires - VERIFIED that a result outside it serialises to an empty content array the model cannot see (spikes/SP-4-agent-loop/REPORT.md section 1 Q5). This is where a long job grows, and therefore where every ladder step does most of its work.
     */
    transcript: {
      /**
       * Seventh in the declared order.
       */
      ordinal: 7;
      /**
       * Size of this section when the account was closed.
       */
      tokens: number;
      /**
       * The ladder may act on this section, within the limits its element kinds allow.
       */
      reducible: true;
      /**
       * The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template. Platform content read back by a tool enters as a bound input carrying its origin.
       */
      renderedFromTemplate?: string;
      /**
       * What the ladder was forbidden to touch inside this section on this request. An unanswered question is listed only while one is open - at most one ask may be open per job, VERIFIED (spikes/SP-21-ask-user-offline/REPORT.md section 1 Q2).
       *
       * Items: One protected element of this section: an unanswered question with the options it was asked with, and the most recent turn.
       */
      protectedElements?: ("unanswered-question" | "most-recent-turn")[];
    };
  };
  /**
   * The prompt templates rendered into this context, one entry per render. A template is the only route by which the product's own instruction text enters a context, and a declared input is the only route by which anything else does. Keeping the two apart here is what makes External Content Is Data a property of the shape rather than of careful prompt writing (INV-AG-39). A section assembled without a template - material carried through unchanged - has no entry.
   *
   * Items: One render of one declared template into one section.
   */
  templatesRendered?: {
    /**
     * Stable identifier of the template. Changing it produces a different instruction, not a new version of one.
     */
    templateId: string;
    /**
     * The template's own version, advanced by its author. Recorded because two runs of the same job under two template versions are two different runs, and a reader comparing them needs to see why.
     */
    templateVersion: string;
    /**
     * Which of the seven sections this render produced. A template renders into exactly one section; nothing renders into a section that does not exist.
     */
    section:
      | "role-instructions"
      | "temporal-anchor"
      | "tool-set"
      | "account-rules"
      | "loaded-skills"
      | "command-and-attachments"
      | "transcript";
    /**
     * Every input slot this template declares, as the template declares them. A render is refused when it is given a name that does not occur here (TEMPLATE_INPUT_UNDECLARED) and when a required name is left unbound (TEMPLATE_INPUT_MISSING); in both cases the job does not start, rather than a different instruction being produced silently.
     *
     * Items: One declared input slot.
     */
    declaredInputs: {
      /**
       * The slot's name, as the template refers to it.
       */
      name: string;
      /**
       * Whether a render that leaves this slot unbound is refused.
       */
      required: boolean;
      /**
       * What may be bound here. 'product-text' is the product's own or the account's own authored wording. 'external-content' is anything read from a platform, a page, a screen, an attachment, a child job or the user's command, and a value bound into such a slot is rendered as quoted data carrying its origin.
       */
      accepts: "product-text" | "external-content";
    }[];
    /**
     * What was actually put into the template for this render. Every entry names a slot the template declared: a render with an undeclared input fails, so it never becomes a section and never acquires an account - which is why this array has no way to express one.
     *
     * Items: One value bound into one declared slot.
     */
    boundInputs: {
      /**
       * The slot this value was bound to. It occurs in declaredInputs; that correspondence is checked at render time, which is the only place both are in hand.
       */
      name: string;
      /**
       * Always true, and refused when written as false. An input the template does not declare cannot be bound - the render fails and no section exists - so a failed render has no valid account, and a document claiming one is refused here rather than believed.
       */
      declared: true;
      /**
       * How the value entered the rendered section. 'instruction-text' is permitted only for the product's own wording and the account's own rules. Everything else is 'quoted-data': set off, attributed to its origin, and never concatenated into the template's own instructions.
       */
      carriedAs: "instruction-text" | "quoted-data";
      /**
       * Where this value came from. It travels with the value into the rendered section, because content whose origin was lost is content the reader has to take on trust.
       */
      origin: {
        /**
         * The kind of source. Only 'product' and 'account-rule' are authored wording - the product's own text, and the account's rules as the elicitation recorded them. The other six are untrusted content whatever they say about themselves. 'web-page' and 'screen' are named here while both capability packs are inactive, so that a pack cannot arrive later carrying content this contract has no name for; the constitution's External Content Is Data section enumerates two sources and its amendment is required before either pack activates (design.md Complexity Tracking).
         */
        kind:
          "product" | "account-rule" | "user-command" | "attachment" | "platform" | "child-job" | "web-page" | "screen";
        /**
         * What identifies the value at its source - a ledger record, a connector object, a child job identifier, an attachment identifier. It is what makes a quoted passage checkable against what was actually read.
         */
        reference?: string;
      };
    }[];
  }[];
  /**
   * The size of the whole context as it stood when this account was closed - after every reduction listed below, if any ran. Read against budget.ceilingTokens and budget.reserveTokens it says what the run had left: a sent request is one that left room for the turn that followed.
   */
  assembledTokens: number;
  /**
   * The reductions applied to this context, in the order they were applied, which is the ladder's order. An empty array is the ordinary case and means the context never approached the reserve. The ladder is closed at four steps and neither a pack nor a role may insert a fifth, because a step that removes the wrong thing is invisible until a run goes wrong.
   *
   * Items: One application of one ladder step against this context.
   */
  reductions: {
    /**
     * Which of the four declared steps ran. They are listed here in ladder order, cheapest and most faithful first: drop reads of an object that a later read superseded; drop results that carried no information, such as an empty search; replace a bulky result with a reference to the ledger record holding it; summarise the older part of the transcript. The first three lose nothing recoverable.
     */
    step: "drop-superseded-reads" | "drop-empty-results" | "reference-bulky-results" | "summarise-older-transcript";
    /**
     * Which section the step acted on. Only the two reducible sources are nameable here: the role's instructions, the temporal anchor, the tool set, the account's rules and the loaded skills cannot appear at all, which is how the protected set survives a ladder asked to free more room than exists.
     */
    appliedTo: "command-and-attachments" | "transcript";
    /**
     * Whether what this step removed can still be read in full elsewhere. True for the first three steps, because what they remove is superseded, empty, or still held in the ledger record the context now references. False only for summarisation, the one step that replaces material with a shorter account of it.
     */
    recoverable: boolean;
    /**
     * What this step took out, and what stands in its place. A step that removed nothing is not recorded: the account lists work done, not work attempted.
     *
     * @minItems 1
     *
     * Items: One kind of material removed by this step.
     */
    removed: [
      {
        /**
         * What kind of material was removed. The set is closed and deliberately holds no member for the job's command, an attachment still in use, the temporal anchor, the tool set, an unanswered question or the most recent turn: the protected set has no name here, so removing one of them is not something this account can describe.
         */
        elementKind: "superseded-read" | "empty-result" | "bulky-result" | "attachment-not-in-use" | "older-turn-range";
        /**
         * How many elements of that kind were removed.
         */
        count: number;
        /**
         * What the context now holds in their place. 'nothing' for material that carried no information; 'ledger-reference' for material still readable in full in the ledger; 'summary' only for summarisation.
         */
        replacedBy: "nothing" | "ledger-reference" | "summary";
        /**
         * The ledger records the context now points at. Required when replacedBy is 'ledger-reference' and forbidden otherwise, because a reference that identifies no record is a loss dressed up as a saving.
         *
         * @minItems 1
         *
         * Items: One ledger record identifier, as ledger/contracts/ledger-record@0.1.0 issues it.
         */
        ledgerRecordIds?: [string, ...string[]];
      } & {
        /**
         * What kind of material was removed. The set is closed and deliberately holds no member for the job's command, an attachment still in use, the temporal anchor, the tool set, an unanswered question or the most recent turn: the protected set has no name here, so removing one of them is not something this account can describe.
         */
        elementKind: "superseded-read" | "empty-result" | "bulky-result" | "attachment-not-in-use" | "older-turn-range";
        /**
         * How many elements of that kind were removed.
         */
        count: number;
        /**
         * What the context now holds in their place. 'nothing' for material that carried no information; 'ledger-reference' for material still readable in full in the ledger; 'summary' only for summarisation.
         */
        replacedBy: "nothing" | "ledger-reference" | "summary";
        /**
         * The ledger records the context now points at. Required when replacedBy is 'ledger-reference' and forbidden otherwise, because a reference that identifies no record is a loss dressed up as a saving.
         *
         * @minItems 1
         *
         * Items: One ledger record identifier, as ledger/contracts/ledger-record@0.1.0 issues it.
         */
        ledgerRecordIds?: [string, ...string[]];
      },
      ...({
        /**
         * What kind of material was removed. The set is closed and deliberately holds no member for the job's command, an attachment still in use, the temporal anchor, the tool set, an unanswered question or the most recent turn: the protected set has no name here, so removing one of them is not something this account can describe.
         */
        elementKind: "superseded-read" | "empty-result" | "bulky-result" | "attachment-not-in-use" | "older-turn-range";
        /**
         * How many elements of that kind were removed.
         */
        count: number;
        /**
         * What the context now holds in their place. 'nothing' for material that carried no information; 'ledger-reference' for material still readable in full in the ledger; 'summary' only for summarisation.
         */
        replacedBy: "nothing" | "ledger-reference" | "summary";
        /**
         * The ledger records the context now points at. Required when replacedBy is 'ledger-reference' and forbidden otherwise, because a reference that identifies no record is a loss dressed up as a saving.
         *
         * @minItems 1
         *
         * Items: One ledger record identifier, as ledger/contracts/ledger-record@0.1.0 issues it.
         */
        ledgerRecordIds?: [string, ...string[]];
      } & {
        /**
         * What kind of material was removed. The set is closed and deliberately holds no member for the job's command, an attachment still in use, the temporal anchor, the tool set, an unanswered question or the most recent turn: the protected set has no name here, so removing one of them is not something this account can describe.
         */
        elementKind: "superseded-read" | "empty-result" | "bulky-result" | "attachment-not-in-use" | "older-turn-range";
        /**
         * How many elements of that kind were removed.
         */
        count: number;
        /**
         * What the context now holds in their place. 'nothing' for material that carried no information; 'ledger-reference' for material still readable in full in the ledger; 'summary' only for summarisation.
         */
        replacedBy: "nothing" | "ledger-reference" | "summary";
        /**
         * The ledger records the context now points at. Required when replacedBy is 'ledger-reference' and forbidden otherwise, because a reference that identifies no record is a loss dressed up as a saving.
         *
         * @minItems 1
         *
         * Items: One ledger record identifier, as ledger/contracts/ledger-record@0.1.0 issues it.
         */
        ledgerRecordIds?: [string, ...string[]];
      })[]
    ];
    /**
     * How much room this step actually freed. Recorded per step because the question SP-23 exists to answer is which step is worth what, and an account recording only a total cannot answer it.
     */
    reclaimedTokens?: number;
  }[];
  /**
   * Every skill whose body is in this context, with why it is there. Recorded per request rather than once per job, because a skill may be loaded mid-job and the budget is re-evaluated when it is.
   *
   * Items: One skill whose body is in this context.
   */
  skillsLoaded: {
    /**
     * The skill identifier, as the catalogue resolved it. Exactly one package answers to it: two packages declaring one identifier never merge (INV-AG-35).
     */
    skillId: string;
    /**
     * Where the package that won precedence came from. Recorded because the same identifier can resolve differently once a capability pack activates, and a run is only reproducible against the package that actually served it.
     */
    origin: "product" | "account" | "pack";
    /**
     * Why this body is here: the role's entry preloads it; the job's work matched its applicability text before the first turn; or the work turned out to match it later, in which case the budget was re-evaluated before the next request.
     */
    reason: "preloaded-by-role" | "matched-at-start" | "matched-mid-job";
    /**
     * The request at which this body first entered the context. For a preloaded or start-matched skill this is 1.
     */
    loadedAtRequestOrdinal: number;
    /**
     * What this body costs inside the loaded-skills section. Optional, and worth recording: load-on-demand exists to keep a large catalogue cheap, and this is the figure that shows whether it did.
     */
    tokens?: number;
  }[];
  /**
   * Skills that were asked for and are not here - a role that preloads an identifier the catalogue does not hold, a skill the user disabled, a skill shadowed by a higher-precedence package. The agent starts without them rather than failing, so this is the only place a later reader learns the playbook was missing.
   *
   * Items: One skill that was asked for and is not in this context.
   */
  skillsUnavailable?: {
    /**
     * The identifier that was asked for.
     */
    skillId: string;
    /**
     * Why it is absent, in the catalogue's own terms.
     */
    reason: "not-in-catalogue" | "invalid" | "disabled" | "shadowed";
  }[];
  /**
   * What became of this assembly. 'sent' is the ordinary case. 'refused-before-first-turn' is a first context that exceeded its budget, so the job never started and the user was told the work is too large for the model assigned to that role. 'exhausted-over-budget' is a context that ran the whole ladder and still exceeded the budget, so the job failed naming the budget rather than sending a request the provider would refuse.
   */
  disposition: "sent" | "refused-before-first-turn" | "exhausted-over-budget";
  /**
   * Why this context was never sent. Present exactly when the disposition is not 'sent', and absent when it is. The user-facing consequence belongs to the job record rather than here: the job's completed-operations list and its undo offer are intact, because a job that ran out of room is still a job that did things.
   */
  failure?: {
    /**
     * 'CONTEXT_OVER_BUDGET_AT_START' when the first assembly already exceeded the ceiling, so the job never started. 'CONTEXT_BUDGET_EXHAUSTED' when the whole ladder ran and the context still exceeded it.
     */
    code: "CONTEXT_OVER_BUDGET_AT_START" | "CONTEXT_BUDGET_EXHAUSTED";
    /**
     * The ceiling the failure names, repeated here so the reason survives beside the account even when it is read apart from the budget record. It is the same figure as budget.ceilingTokens.
     */
    statedCeilingTokens: number;
    /**
     * What the user is told, in the product's own words - which model the work was too large for, and which role that model is assigned to.
     */
    detail?: string;
  };
};


export const CONTEXT_ASSEMBLY_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/context-assembly/1.0.0.json",
  "title": "AssembledContextAccount",
  "description": "Normative shape of the account that one model request's assembled context keeps of its own construction, for agent/contracts/context-assembly@1.0.0. The assembled context itself is memory only and is never an artifact; this document is what is recorded against the job, replicated with it, and read back when a run has to be explained (INV-AG-37). Three things the assembly guarantees are made structural here rather than left to prose. The seven declared sources are the seven members of 'sections', all required and nothing else admitted, each carrying the fixed ordinal that is its place in the declared order - so a context assembled from six sources, or in another order, has no valid account. A reduction can name only a section the ladder is allowed to act on and only an element kind the ladder is allowed to remove, so the protected set has no representable target. And an input bound into a template is one the template declared, so a render with an undeclared input - which fails, and produces no section - has no valid account either. What this file cannot check is stated by the contract document: that the recorded reductions ran in ladder order, that a bound input's name occurs in declaredInputs, and that a token count taken by the composer matches the provider's. No threshold here is fixed by this file: the reserve fraction and the retained-tail size are UNVERIFIED and await the measurement proposed as SP-23 in design.md R1.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "accountVersion",
    "jobId",
    "requestOrdinal",
    "roleId",
    "budget",
    "sections",
    "assembledTokens",
    "reductions",
    "skillsLoaded",
    "disposition"
  ],
  "properties": {
    "accountVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "The version of the context-assembly contract this account was written against. The account travels with the job record and therefore replicates between devices on different builds: a newer build reads an older account unchanged, and an older build meeting a newer version refuses the account whole (ACCOUNT_VERSION_AHEAD) rather than reading around a member it does not recognise, because an unread reduction entry is a claim about what the model saw that nobody can check."
    },
    "jobId": {
      "type": "string",
      "minLength": 1,
      "description": "The job this context was assembled for. One job's context holds nothing from any other job, so this identifier is also the whole of the account's scope."
    },
    "requestOrdinal": {
      "type": "integer",
      "minimum": 1,
      "description": "Which model request of this job the context was built for, counting from one. A job produces one account per request, so the job identifier and this ordinal together name exactly one assembly."
    },
    "roleId": {
      "type": "string",
      "minLength": 1,
      "description": "The role registry identifier the agent runs under. Recorded because the role supplies the first section and names the tier the budget was derived through, and because a job whose role changed halfway would be a job whose account cannot be read - which is why a running job's model does not change (design.md D5)."
    },
    "budget": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "unit",
        "derivation",
        "ceilingTokens",
        "reserveTokens"
      ],
      "description": "How much of the assigned model's declared window this job may spend, and how that figure was arrived at. Recorded when the job starts. The reserve fraction that turns a window into a ceiling and a reserve is a provisional declared default - 20% of the ceiling, never below 8 000 tokens, with a 32 000-token fallback ceiling when no window is declared - UNVERIFIED, and design.md R1 proposes SP-23 to measure it.",
      "properties": {
        "unit": {
          "const": "tokens",
          "description": "Every figure in this account is a token count. The count is the composer's own, taken before the request is sent; the provider's count is the authoritative one and may differ, which is one of the reasons a reserve exists at all rather than the ceiling being the window itself."
        },
        "derivation": {
          "enum": [
            "model-window",
            "declared-fallback"
          ],
          "description": "How the ceiling was arrived at. 'model-window' means it was derived from the context window the assigned model's provider profile declares, and modelWindowTokens records that window. 'declared-fallback' means the profile declared no window, so the product used its declared fallback budget - recorded here AS a fallback rather than dressed up as a derived figure, because a reader comparing two runs needs to know which of them was guessing."
        },
        "modelWindowTokens": {
          "type": "integer",
          "minimum": 1,
          "description": "The context window the assigned model's provider profile declares. Required when derivation is 'model-window' and forbidden otherwise, so a fallback can never be recorded as though a window had been read."
        },
        "ceilingTokens": {
          "type": "integer",
          "minimum": 1,
          "description": "The whole of what this job may spend on one request. A job does not start when its first assembled context already exceeds it."
        },
        "reserveTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Headroom held back inside the ceiling for the turn that follows. Reduction begins when the assembled context plus the expected next turn crosses it. The size of the reserve is a provisional declared default - 20% of the ceiling, never below 8 000 tokens - UNVERIFIED, pending SP-23."
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "derivation": {
                "const": "model-window"
              }
            },
            "required": [
              "derivation"
            ]
          },
          "then": {
            "required": [
              "modelWindowTokens"
            ]
          },
          "else": {
            "not": {
              "required": [
                "modelWindowTokens"
              ]
            }
          }
        }
      ]
    },
    "sections": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "role-instructions",
        "temporal-anchor",
        "tool-set",
        "account-rules",
        "loaded-skills",
        "command-and-attachments",
        "transcript"
      ],
      "description": "The seven declared context sources, all seven always present. The set is closed: an eighth source is a MAJOR revision of this contract, because a new place for material to come from is a new place external content can enter. Each member carries the fixed ordinal that is its place in the declared order, so the order is a property of the source rather than of how the account happened to be written. A source that was present and empty has a section of zero tokens; a source that could not be read stops the job instead (CONTEXT_SOURCE_UNAVAILABLE), so absence never has to be distinguished from emptiness here.",
      "properties": {
        "role-instructions": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "1. The role's durable instructions, from its registry entry. Not reducible: an agent whose identity was summarised is a different agent.",
          "properties": {
            "ordinal": {
              "const": 1,
              "description": "First in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": false,
              "description": "The ladder may not act on this section."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template."
            }
          }
        },
        "temporal-anchor": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "2. The instant every relative date resolves against, in the shape agent/contracts/worker-loop@0.1.0 already requires (worker-loop.prompt-context.schema.json). Protected: its absence is what produced the boundary-day errors of case S-16 - VERIFIED (spikes/SP-4-agent-loop/REPORT.md section 1 Q1).",
          "properties": {
            "ordinal": {
              "const": 2,
              "description": "Second in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": false,
              "description": "The ladder may not act on this section."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template."
            }
          }
        },
        "tool-set": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "3. The tools this session holds, resolved once from the role's allowlist and frozen for the life of the session (INV-AG-33). Protected: an agent that has lost the list of what it can do reports completion it never performed.",
          "properties": {
            "ordinal": {
              "const": 3,
              "description": "Third in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": false,
              "description": "The ladder may not act on this section."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template."
            }
          }
        },
        "account-rules": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "4. The account's rules, rendered as advisory text. Advisory is the whole of it: enforcement is the gate's, in the application layer, where no model output reaches it (constitution principle II). Not reducible, because a half-present rule set reads as a complete one.",
          "properties": {
            "ordinal": {
              "const": 4,
              "description": "Fourth in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": false,
              "description": "The ladder may not act on this section."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template."
            }
          }
        },
        "loaded-skills": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "5. The bodies of the skills this job loaded, listed individually in skillsLoaded. Not reducible: a playbook missing the part the job had not reached yet is a playbook that misleads. A body is released when the job reaches a terminal state, not by the ladder.",
          "properties": {
            "ordinal": {
              "const": 5,
              "description": "Fifth in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": false,
              "description": "The ladder may not act on this section."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template."
            }
          }
        },
        "command-and-attachments": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "6. What the user asked for, and what they dropped in with it. Reducible in one direction only: an attachment no longer in use may be replaced by a reference to its ledger record. The command itself and an attachment still in use are protected, and neither has a representable elementKind in a reduction entry.",
          "properties": {
            "ordinal": {
              "const": 6,
              "description": "Sixth in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": true,
              "description": "The ladder may act on this section, within the limits its element kinds allow."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section. The command and every attachment enter it as bound inputs carrying their origin, never as part of the template's own instruction text (INV-AG-39)."
            },
            "protectedElements": {
              "type": "array",
              "uniqueItems": true,
              "description": "What the ladder was forbidden to touch inside this section on this request.",
              "items": {
                "enum": [
                  "command",
                  "attachment-in-use"
                ],
                "description": "One protected element of this section: the job's command, and an attachment still in use."
              }
            }
          }
        },
        "transcript": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ordinal",
            "tokens",
            "reducible"
          ],
          "description": "7. The job's own turns and tool results, each result in the envelope agent/contracts/worker-loop@0.1.0 requires - VERIFIED that a result outside it serialises to an empty content array the model cannot see (spikes/SP-4-agent-loop/REPORT.md section 1 Q5). This is where a long job grows, and therefore where every ladder step does most of its work.",
          "properties": {
            "ordinal": {
              "const": 7,
              "description": "Seventh in the declared order."
            },
            "tokens": {
              "type": "integer",
              "minimum": 0,
              "description": "Size of this section when the account was closed."
            },
            "reducible": {
              "const": true,
              "description": "The ladder may act on this section, within the limits its element kinds allow."
            },
            "renderedFromTemplate": {
              "type": "string",
              "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
              "description": "The templateId of the entry in templatesRendered that produced this section, when the product composed it from a template. Platform content read back by a tool enters as a bound input carrying its origin."
            },
            "protectedElements": {
              "type": "array",
              "uniqueItems": true,
              "description": "What the ladder was forbidden to touch inside this section on this request. An unanswered question is listed only while one is open - at most one ask may be open per job, VERIFIED (spikes/SP-21-ask-user-offline/REPORT.md section 1 Q2).",
              "items": {
                "enum": [
                  "unanswered-question",
                  "most-recent-turn"
                ],
                "description": "One protected element of this section: an unanswered question with the options it was asked with, and the most recent turn."
              }
            }
          }
        }
      }
    },
    "templatesRendered": {
      "type": "array",
      "description": "The prompt templates rendered into this context, one entry per render. A template is the only route by which the product's own instruction text enters a context, and a declared input is the only route by which anything else does. Keeping the two apart here is what makes External Content Is Data a property of the shape rather than of careful prompt writing (INV-AG-39). A section assembled without a template - material carried through unchanged - has no entry.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "templateId",
          "templateVersion",
          "section",
          "declaredInputs",
          "boundInputs"
        ],
        "description": "One render of one declared template into one section.",
        "properties": {
          "templateId": {
            "type": "string",
            "pattern": "^[a-z0-9]+(?:[.-][a-z0-9]+)*$",
            "description": "Stable identifier of the template. Changing it produces a different instruction, not a new version of one."
          },
          "templateVersion": {
            "type": "string",
            "pattern": "^\\d+\\.\\d+\\.\\d+$",
            "description": "The template's own version, advanced by its author. Recorded because two runs of the same job under two template versions are two different runs, and a reader comparing them needs to see why."
          },
          "section": {
            "enum": [
              "role-instructions",
              "temporal-anchor",
              "tool-set",
              "account-rules",
              "loaded-skills",
              "command-and-attachments",
              "transcript"
            ],
            "description": "Which of the seven sections this render produced. A template renders into exactly one section; nothing renders into a section that does not exist."
          },
          "declaredInputs": {
            "type": "array",
            "description": "Every input slot this template declares, as the template declares them. A render is refused when it is given a name that does not occur here (TEMPLATE_INPUT_UNDECLARED) and when a required name is left unbound (TEMPLATE_INPUT_MISSING); in both cases the job does not start, rather than a different instruction being produced silently.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "name",
                "required",
                "accepts"
              ],
              "description": "One declared input slot.",
              "properties": {
                "name": {
                  "type": "string",
                  "pattern": "^[a-zA-Z][a-zA-Z0-9]*$",
                  "description": "The slot's name, as the template refers to it."
                },
                "required": {
                  "type": "boolean",
                  "description": "Whether a render that leaves this slot unbound is refused."
                },
                "accepts": {
                  "enum": [
                    "product-text",
                    "external-content"
                  ],
                  "description": "What may be bound here. 'product-text' is the product's own or the account's own authored wording. 'external-content' is anything read from a platform, a page, a screen, an attachment, a child job or the user's command, and a value bound into such a slot is rendered as quoted data carrying its origin."
                }
              }
            }
          },
          "boundInputs": {
            "type": "array",
            "description": "What was actually put into the template for this render. Every entry names a slot the template declared: a render with an undeclared input fails, so it never becomes a section and never acquires an account - which is why this array has no way to express one.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "name",
                "declared",
                "carriedAs",
                "origin"
              ],
              "description": "One value bound into one declared slot.",
              "properties": {
                "name": {
                  "type": "string",
                  "pattern": "^[a-zA-Z][a-zA-Z0-9]*$",
                  "description": "The slot this value was bound to. It occurs in declaredInputs; that correspondence is checked at render time, which is the only place both are in hand."
                },
                "declared": {
                  "const": true,
                  "description": "Always true, and refused when written as false. An input the template does not declare cannot be bound - the render fails and no section exists - so a failed render has no valid account, and a document claiming one is refused here rather than believed."
                },
                "carriedAs": {
                  "enum": [
                    "instruction-text",
                    "quoted-data"
                  ],
                  "description": "How the value entered the rendered section. 'instruction-text' is permitted only for the product's own wording and the account's own rules. Everything else is 'quoted-data': set off, attributed to its origin, and never concatenated into the template's own instructions."
                },
                "origin": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": [
                    "kind"
                  ],
                  "description": "Where this value came from. It travels with the value into the rendered section, because content whose origin was lost is content the reader has to take on trust.",
                  "properties": {
                    "kind": {
                      "enum": [
                        "product",
                        "account-rule",
                        "user-command",
                        "attachment",
                        "platform",
                        "child-job",
                        "web-page",
                        "screen"
                      ],
                      "description": "The kind of source. Only 'product' and 'account-rule' are authored wording - the product's own text, and the account's rules as the elicitation recorded them. The other six are untrusted content whatever they say about themselves. 'web-page' and 'screen' are named here while both capability packs are inactive, so that a pack cannot arrive later carrying content this contract has no name for; the constitution's External Content Is Data section enumerates two sources and its amendment is required before either pack activates (design.md Complexity Tracking)."
                    },
                    "reference": {
                      "type": "string",
                      "minLength": 1,
                      "description": "What identifies the value at its source - a ledger record, a connector object, a child job identifier, an attachment identifier. It is what makes a quoted passage checkable against what was actually read."
                    }
                  }
                }
              },
              "allOf": [
                {
                  "if": {
                    "properties": {
                      "origin": {
                        "type": "object",
                        "properties": {
                          "kind": {
                            "enum": [
                              "product",
                              "account-rule"
                            ]
                          }
                        },
                        "required": [
                          "kind"
                        ]
                      }
                    },
                    "required": [
                      "origin"
                    ]
                  },
                  "then": true,
                  "else": {
                    "properties": {
                      "carriedAs": {
                        "const": "quoted-data",
                        "description": "External content is carried as quoted data and never as instruction text. This branch is the schema's whole enforcement of INV-AG-39."
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    "assembledTokens": {
      "type": "integer",
      "minimum": 0,
      "description": "The size of the whole context as it stood when this account was closed - after every reduction listed below, if any ran. Read against budget.ceilingTokens and budget.reserveTokens it says what the run had left: a sent request is one that left room for the turn that followed."
    },
    "reductions": {
      "type": "array",
      "description": "The reductions applied to this context, in the order they were applied, which is the ladder's order. An empty array is the ordinary case and means the context never approached the reserve. The ladder is closed at four steps and neither a pack nor a role may insert a fifth, because a step that removes the wrong thing is invisible until a run goes wrong.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "step",
          "appliedTo",
          "recoverable",
          "removed"
        ],
        "description": "One application of one ladder step against this context.",
        "properties": {
          "step": {
            "enum": [
              "drop-superseded-reads",
              "drop-empty-results",
              "reference-bulky-results",
              "summarise-older-transcript"
            ],
            "description": "Which of the four declared steps ran. They are listed here in ladder order, cheapest and most faithful first: drop reads of an object that a later read superseded; drop results that carried no information, such as an empty search; replace a bulky result with a reference to the ledger record holding it; summarise the older part of the transcript. The first three lose nothing recoverable."
          },
          "appliedTo": {
            "enum": [
              "command-and-attachments",
              "transcript"
            ],
            "description": "Which section the step acted on. Only the two reducible sources are nameable here: the role's instructions, the temporal anchor, the tool set, the account's rules and the loaded skills cannot appear at all, which is how the protected set survives a ladder asked to free more room than exists."
          },
          "recoverable": {
            "type": "boolean",
            "description": "Whether what this step removed can still be read in full elsewhere. True for the first three steps, because what they remove is superseded, empty, or still held in the ledger record the context now references. False only for summarisation, the one step that replaces material with a shorter account of it."
          },
          "removed": {
            "type": "array",
            "minItems": 1,
            "description": "What this step took out, and what stands in its place. A step that removed nothing is not recorded: the account lists work done, not work attempted.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "elementKind",
                "count",
                "replacedBy"
              ],
              "description": "One kind of material removed by this step.",
              "properties": {
                "elementKind": {
                  "enum": [
                    "superseded-read",
                    "empty-result",
                    "bulky-result",
                    "attachment-not-in-use",
                    "older-turn-range"
                  ],
                  "description": "What kind of material was removed. The set is closed and deliberately holds no member for the job's command, an attachment still in use, the temporal anchor, the tool set, an unanswered question or the most recent turn: the protected set has no name here, so removing one of them is not something this account can describe."
                },
                "count": {
                  "type": "integer",
                  "minimum": 1,
                  "description": "How many elements of that kind were removed."
                },
                "replacedBy": {
                  "enum": [
                    "nothing",
                    "ledger-reference",
                    "summary"
                  ],
                  "description": "What the context now holds in their place. 'nothing' for material that carried no information; 'ledger-reference' for material still readable in full in the ledger; 'summary' only for summarisation."
                },
                "ledgerRecordIds": {
                  "type": "array",
                  "minItems": 1,
                  "uniqueItems": true,
                  "description": "The ledger records the context now points at. Required when replacedBy is 'ledger-reference' and forbidden otherwise, because a reference that identifies no record is a loss dressed up as a saving.",
                  "items": {
                    "type": "string",
                    "minLength": 1,
                    "description": "One ledger record identifier, as ledger/contracts/ledger-record@0.1.0 issues it."
                  }
                }
              },
              "allOf": [
                {
                  "if": {
                    "properties": {
                      "replacedBy": {
                        "const": "ledger-reference"
                      }
                    },
                    "required": [
                      "replacedBy"
                    ]
                  },
                  "then": {
                    "required": [
                      "ledgerRecordIds"
                    ]
                  },
                  "else": {
                    "not": {
                      "required": [
                        "ledgerRecordIds"
                      ]
                    }
                  }
                }
              ]
            }
          },
          "reclaimedTokens": {
            "type": "integer",
            "minimum": 0,
            "description": "How much room this step actually freed. Recorded per step because the question SP-23 exists to answer is which step is worth what, and an account recording only a total cannot answer it."
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "step": {
                  "const": "summarise-older-transcript"
                }
              },
              "required": [
                "step"
              ]
            },
            "then": {
              "properties": {
                "recoverable": {
                  "const": false
                }
              }
            },
            "else": {
              "properties": {
                "recoverable": {
                  "const": true
                }
              }
            }
          }
        ]
      }
    },
    "skillsLoaded": {
      "type": "array",
      "description": "Every skill whose body is in this context, with why it is there. Recorded per request rather than once per job, because a skill may be loaded mid-job and the budget is re-evaluated when it is.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "skillId",
          "origin",
          "reason",
          "loadedAtRequestOrdinal"
        ],
        "description": "One skill whose body is in this context.",
        "properties": {
          "skillId": {
            "type": "string",
            "minLength": 1,
            "description": "The skill identifier, as the catalogue resolved it. Exactly one package answers to it: two packages declaring one identifier never merge (INV-AG-35)."
          },
          "origin": {
            "enum": [
              "product",
              "account",
              "pack"
            ],
            "description": "Where the package that won precedence came from. Recorded because the same identifier can resolve differently once a capability pack activates, and a run is only reproducible against the package that actually served it."
          },
          "reason": {
            "enum": [
              "preloaded-by-role",
              "matched-at-start",
              "matched-mid-job"
            ],
            "description": "Why this body is here: the role's entry preloads it; the job's work matched its applicability text before the first turn; or the work turned out to match it later, in which case the budget was re-evaluated before the next request."
          },
          "loadedAtRequestOrdinal": {
            "type": "integer",
            "minimum": 1,
            "description": "The request at which this body first entered the context. For a preloaded or start-matched skill this is 1."
          },
          "tokens": {
            "type": "integer",
            "minimum": 0,
            "description": "What this body costs inside the loaded-skills section. Optional, and worth recording: load-on-demand exists to keep a large catalogue cheap, and this is the figure that shows whether it did."
          }
        }
      }
    },
    "skillsUnavailable": {
      "type": "array",
      "description": "Skills that were asked for and are not here - a role that preloads an identifier the catalogue does not hold, a skill the user disabled, a skill shadowed by a higher-precedence package. The agent starts without them rather than failing, so this is the only place a later reader learns the playbook was missing.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "skillId",
          "reason"
        ],
        "description": "One skill that was asked for and is not in this context.",
        "properties": {
          "skillId": {
            "type": "string",
            "minLength": 1,
            "description": "The identifier that was asked for."
          },
          "reason": {
            "enum": [
              "not-in-catalogue",
              "invalid",
              "disabled",
              "shadowed"
            ],
            "description": "Why it is absent, in the catalogue's own terms."
          }
        }
      }
    },
    "disposition": {
      "enum": [
        "sent",
        "refused-before-first-turn",
        "exhausted-over-budget"
      ],
      "description": "What became of this assembly. 'sent' is the ordinary case. 'refused-before-first-turn' is a first context that exceeded its budget, so the job never started and the user was told the work is too large for the model assigned to that role. 'exhausted-over-budget' is a context that ran the whole ladder and still exceeded the budget, so the job failed naming the budget rather than sending a request the provider would refuse."
    },
    "failure": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "statedCeilingTokens"
      ],
      "description": "Why this context was never sent. Present exactly when the disposition is not 'sent', and absent when it is. The user-facing consequence belongs to the job record rather than here: the job's completed-operations list and its undo offer are intact, because a job that ran out of room is still a job that did things.",
      "properties": {
        "code": {
          "enum": [
            "CONTEXT_OVER_BUDGET_AT_START",
            "CONTEXT_BUDGET_EXHAUSTED"
          ],
          "description": "'CONTEXT_OVER_BUDGET_AT_START' when the first assembly already exceeded the ceiling, so the job never started. 'CONTEXT_BUDGET_EXHAUSTED' when the whole ladder ran and the context still exceeded it."
        },
        "statedCeilingTokens": {
          "type": "integer",
          "minimum": 1,
          "description": "The ceiling the failure names, repeated here so the reason survives beside the account even when it is read apart from the budget record. It is the same figure as budget.ceilingTokens."
        },
        "detail": {
          "type": "string",
          "minLength": 1,
          "description": "What the user is told, in the product's own words - which model the work was too large for, and which role that model is assigned to."
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "disposition": {
            "const": "sent"
          }
        },
        "required": [
          "disposition"
        ]
      },
      "then": {
        "not": {
          "required": [
            "failure"
          ]
        }
      },
      "else": {
        "required": [
          "failure"
        ]
      }
    }
  ]
} as const;
