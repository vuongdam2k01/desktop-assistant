/**
 * The three documents of agent/contracts/job-delegation@1.0.0: the child job link record, the assignment a child is given, and the delegation result a parent reads. A document satisfying one of them is one of the three; there is no fourth shape, because there is no fourth thing that passes between a parent and a child. What this file cannot express is stated by the contract document: that the fan-out bound counts unfinished children, which is a question about job states this file does not hold; that the delegation grant belongs to the calling job's role entry; and that a delegation result is external content wherever it is read, which no validator can check because it is a property of how the material is used rather than of how it is shaped.
 */
export type JobDelegationDocuments = ChildJobLink | ChildJobAssignment1 | DelegationResult;

/**
 * The recorded fact that one job was created by an agent running another. One per child, and the only channel between a parent and a child (INV-JOB-08). A job record with no link is a top-level job, which is both the meaning of absence and the migration posture for every job written before this contract.
 */
export interface ChildJobLink {
  /**
   * The job whose agent created this one. The single field that distinguishes a child from any other job: it is queued, gated, recorded, recovered and cancelled by exactly the same machinery as a job the user created.
   */
  parentJobId: string;
  /**
   * The job that was created. A parent holds this identifier and reads the record it names; it never holds a reference to the running agent behind it.
   */
  childJobId: string;
  assignment: ChildJobAssignment;
  /**
   * Always 1. Delegation is bounded at one level: a job holding a link may not create one. Expressing the bound as a constant means a grandchild is not a record this format can hold, rather than a case the runtime must remember to refuse. Raising the bound is a MINOR revision of the contract and a revision of this schema, and it needs its own evidence: the neighbouring measurement is spikes/SP-15-concurrency/REPORT.md section 1 Q4, where eight concurrent jobs against one connector account crossed into platform refusals at about five percent while three completed cleanly (VERIFIED), and depth multiplies against that budget. The bound itself is UNVERIFIED.
   */
  depth: 1;
  /**
   * When the link was written. The creation is itself a tool call, so a ledger record precedes it and carries the authoritative account of the step (principle III).
   */
  createdAt: string;
}
/**
 * What the child was given, held whole rather than decomposed, because the assignment is the unit that is validated and the unit that replicates. Splitting its text away from its quoted inputs would create a second place where the origin of external material is asserted.
 */
export interface ChildJobAssignment {
  /**
   * The role the child runs under. Must be named by the calling role entry's delegation grant, or the delegation is refused with ROLE_NOT_PERMITTED; must exist in the registry, or ROLE_UNKNOWN. Neither check is expressible here, because neither the grant nor the registry is in this document.
   */
  roleId: string;
  /**
   * The work, in the parent's own words. The ceiling mirrors the 16 KiB ceiling model.md declares for a role entry's instructions and is UNVERIFIED for the same reason: it is a declared budget chosen so that a link row can be read without a size surprise, and no spike has measured it.
   */
  text: string;
  /**
   * Material the parent read and wants the child to have. A separate member rather than something the parent pastes into 'text', so that material the parent obtained from a platform reaches the child still marked as material rather than as instruction the parent appears to have written.
   *
   * @maxItems 8
   */
  inputs?:
    | []
    | [QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent, QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent, QuotedExternalContent, QuotedExternalContent]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ];
}
/**
 * External material carried as a value with its origin attached. This is the only shape in which untrusted material moves between a parent and a child, in either direction. It exists so that such material enters an assembled context as a declared template input rather than as text concatenated into an instruction (INV-AG-39), which is what makes 'External Content Is Data' a property of the shape instead of a matter of careful prompt writing.
 */
export interface QuotedExternalContent {
  /**
   * Where the material came from. A child's report is always 'child-job-report' whatever role the child ran under, because a child is a machine that read untrusted material and its report is therefore untrusted material (INV-JOB-09).
   */
  origin: "child-job-report" | "connector-content" | "user-input";
  /**
   * The job whose run produced or read the material, so that a reader can say whose material this is and follow it back to the ledger records of the calls that obtained it.
   */
  originJobId: string;
  /**
   * The material itself, quoted. It authorises nothing: it cannot approve an operation, relax an approval decision, alter a rule or widen a tool allowlist. The ceiling matches the assignment's and is UNVERIFIED — a declared budget, not a measurement.
   */
  text: string;
  /**
   * Whether the material was cut to fit the ceiling. Recorded rather than inferred, because a reader deciding what a child actually saw must be able to tell a short report from a shortened one.
   */
  truncated: boolean;
}
/**
 * The whole of what a child is given. There is no second channel that adds to it afterwards, no shared state it can reach, and nothing of the parent's transcript or tool set travels with it: a child holds only what this document gave it and what its own role entry declares.
 */
export interface ChildJobAssignment1 {
  /**
   * The role the child runs under. Must be named by the calling role entry's delegation grant, or the delegation is refused with ROLE_NOT_PERMITTED; must exist in the registry, or ROLE_UNKNOWN. Neither check is expressible here, because neither the grant nor the registry is in this document.
   */
  roleId: string;
  /**
   * The work, in the parent's own words. The ceiling mirrors the 16 KiB ceiling model.md declares for a role entry's instructions and is UNVERIFIED for the same reason: it is a declared budget chosen so that a link row can be read without a size surprise, and no spike has measured it.
   */
  text: string;
  /**
   * Material the parent read and wants the child to have. A separate member rather than something the parent pastes into 'text', so that material the parent obtained from a platform reaches the child still marked as material rather than as instruction the parent appears to have written.
   *
   * @maxItems 8
   */
  inputs?:
    | []
    | [QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent, QuotedExternalContent]
    | [QuotedExternalContent, QuotedExternalContent, QuotedExternalContent, QuotedExternalContent]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ]
    | [
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent,
        QuotedExternalContent
      ];
}
/**
 * What a parent reads when a child reaches a terminal state. Projected from the child's own job record rather than stored a second time, so that there is no copy that can go stale in the direction that tells a parent a failed child succeeded. Everything in it that a child wrote is external content (INV-JOB-09).
 */
export interface DelegationResult {
  /**
   * Which child this is the result of. The parent matches it against the identifiers its links name.
   */
  childJobId: string;
  /**
   * The role the child ran under. Carried because the account of a run attributes spend and behaviour to a role, and a reader comparing three children's results needs to know they were not all the same kind of agent.
   */
  roleId: string;
  /**
   * The child's outcome. 'failed' and 'cancelled' are results, not the parent's failure: the parent remains able to continue and decides what to report, because a parent that died with its child would lose the account of the children that succeeded — and that account is what the undo offer is built from.
   */
  terminalState: "done" | "failed" | "cancelled";
  report?: QuotedExternalContent1;
  failureReason?: QuotedExternalContent2;
  /**
   * What the child actually completed, by ledger reference rather than by the child's description of it. Empty is meaningful and common. This is the member that makes the parent's completed-operations list cover its children's writes, so that an undo offer after a parent's failure reaches the real changes rather than stopping at the parent's own calls.
   */
  completedOperations: CompletedOperationRef[];
  /**
   * When the child reached its terminal state. A parent returns from 'waiting_children' to 'running' once every child has one.
   */
  finishedAt: string;
}
/**
 * External material carried as a value with its origin attached. This is the only shape in which untrusted material moves between a parent and a child, in either direction. It exists so that such material enters an assembled context as a declared template input rather than as text concatenated into an instruction (INV-AG-39), which is what makes 'External Content Is Data' a property of the shape instead of a matter of careful prompt writing.
 */
export interface QuotedExternalContent1 {
  /**
   * Where the material came from. A child's report is always 'child-job-report' whatever role the child ran under, because a child is a machine that read untrusted material and its report is therefore untrusted material (INV-JOB-09).
   */
  origin: "child-job-report" | "connector-content" | "user-input";
  /**
   * The job whose run produced or read the material, so that a reader can say whose material this is and follow it back to the ledger records of the calls that obtained it.
   */
  originJobId: string;
  /**
   * The material itself, quoted. It authorises nothing: it cannot approve an operation, relax an approval decision, alter a rule or widen a tool allowlist. The ceiling matches the assignment's and is UNVERIFIED — a declared budget, not a measurement.
   */
  text: string;
  /**
   * Whether the material was cut to fit the ceiling. Recorded rather than inferred, because a reader deciding what a child actually saw must be able to tell a short report from a shortened one.
   */
  truncated: boolean;
}
/**
 * External material carried as a value with its origin attached. This is the only shape in which untrusted material moves between a parent and a child, in either direction. It exists so that such material enters an assembled context as a declared template input rather than as text concatenated into an instruction (INV-AG-39), which is what makes 'External Content Is Data' a property of the shape instead of a matter of careful prompt writing.
 */
export interface QuotedExternalContent2 {
  /**
   * Where the material came from. A child's report is always 'child-job-report' whatever role the child ran under, because a child is a machine that read untrusted material and its report is therefore untrusted material (INV-JOB-09).
   */
  origin: "child-job-report" | "connector-content" | "user-input";
  /**
   * The job whose run produced or read the material, so that a reader can say whose material this is and follow it back to the ledger records of the calls that obtained it.
   */
  originJobId: string;
  /**
   * The material itself, quoted. It authorises nothing: it cannot approve an operation, relax an approval decision, alter a rule or widen a tool allowlist. The ceiling matches the assignment's and is UNVERIFIED — a declared budget, not a measurement.
   */
  text: string;
  /**
   * Whether the material was cut to fit the ceiling. Recorded rather than inferred, because a reader deciding what a child actually saw must be able to tell a short report from a shortened one.
   */
  truncated: boolean;
}
/**
 * One operation a child completed, named by its ledger record. A reference rather than a copy: the ledger holds the snapshot and the compensating action, and this member exists only so a parent's account can reach them.
 */
export interface CompletedOperationRef {
  /**
   * The record in the append-only ledger, owned by ledger/contracts/ledger-record@0.1.0. It, not this projection, is the authority on what happened.
   */
  ledgerRecordId: string;
  /**
   * The tool the child called, so the operation can be presented to the user in the same words as the parent's own operations.
   */
  toolName: string;
  /**
   * The connector account the call ran against. Carried because it is the key the concurrency budget uses: a child draws on the same per-account limit as every other job and never on a budget of its own (INV-JOB-10).
   */
  connectorAccountId: string;
  /**
   * False where the operation declared irreversible: true (principle IV). The undo offer says so rather than omitting the operation, because an operation silently missing from the list reads as an operation that did not happen.
   */
  compensable: boolean;
}


export const JOB_DELEGATION_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/job-delegation/1.0.0.json",
  "title": "JobDelegationDocuments",
  "description": "The three documents of agent/contracts/job-delegation@1.0.0: the child job link record, the assignment a child is given, and the delegation result a parent reads. A document satisfying one of them is one of the three; there is no fourth shape, because there is no fourth thing that passes between a parent and a child. What this file cannot express is stated by the contract document: that the fan-out bound counts unfinished children, which is a question about job states this file does not hold; that the delegation grant belongs to the calling job's role entry; and that a delegation result is external content wherever it is read, which no validator can check because it is a property of how the material is used rather than of how it is shaped.",
  "oneOf": [
    {
      "$ref": "#/$defs/ChildJobLink"
    },
    {
      "$ref": "#/$defs/ChildJobAssignment"
    },
    {
      "$ref": "#/$defs/DelegationResult"
    }
  ],
  "$defs": {
    "JobId": {
      "type": "string",
      "pattern": "^job_[A-Za-z0-9_-]{1,64}$",
      "description": "Identifier of a job record. A parent holds these and nothing else: there is no handle to a running agent anywhere in this contract."
    },
    "RoleId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "Identifier of an entry in the role registry, owned by agent/contracts/role-registry@1.0.0. Named here, never defined here."
    },
    "Timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601. Displayed, never used to order across devices: ordering between devices is the replication protocol's causal position, not a clock on any one machine."
    },
    "QuotedExternalContent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "origin",
        "originJobId",
        "text",
        "truncated"
      ],
      "description": "External material carried as a value with its origin attached. This is the only shape in which untrusted material moves between a parent and a child, in either direction. It exists so that such material enters an assembled context as a declared template input rather than as text concatenated into an instruction (INV-AG-39), which is what makes 'External Content Is Data' a property of the shape instead of a matter of careful prompt writing.",
      "properties": {
        "origin": {
          "enum": [
            "child-job-report",
            "connector-content",
            "user-input"
          ],
          "description": "Where the material came from. A child's report is always 'child-job-report' whatever role the child ran under, because a child is a machine that read untrusted material and its report is therefore untrusted material (INV-JOB-09)."
        },
        "originJobId": {
          "$ref": "#/$defs/JobId",
          "description": "The job whose run produced or read the material, so that a reader can say whose material this is and follow it back to the ledger records of the calls that obtained it."
        },
        "text": {
          "type": "string",
          "maxLength": 16384,
          "description": "The material itself, quoted. It authorises nothing: it cannot approve an operation, relax an approval decision, alter a rule or widen a tool allowlist. The ceiling matches the assignment's and is UNVERIFIED — a declared budget, not a measurement."
        },
        "truncated": {
          "type": "boolean",
          "description": "Whether the material was cut to fit the ceiling. Recorded rather than inferred, because a reader deciding what a child actually saw must be able to tell a short report from a shortened one."
        }
      }
    },
    "ChildJobAssignment": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "roleId",
        "text"
      ],
      "description": "The whole of what a child is given. There is no second channel that adds to it afterwards, no shared state it can reach, and nothing of the parent's transcript or tool set travels with it: a child holds only what this document gave it and what its own role entry declares.",
      "properties": {
        "roleId": {
          "$ref": "#/$defs/RoleId",
          "description": "The role the child runs under. Must be named by the calling role entry's delegation grant, or the delegation is refused with ROLE_NOT_PERMITTED; must exist in the registry, or ROLE_UNKNOWN. Neither check is expressible here, because neither the grant nor the registry is in this document."
        },
        "text": {
          "type": "string",
          "minLength": 1,
          "maxLength": 16384,
          "description": "The work, in the parent's own words. The ceiling mirrors the 16 KiB ceiling model.md declares for a role entry's instructions and is UNVERIFIED for the same reason: it is a declared budget chosen so that a link row can be read without a size surprise, and no spike has measured it."
        },
        "inputs": {
          "type": "array",
          "maxItems": 8,
          "items": {
            "$ref": "#/$defs/QuotedExternalContent"
          },
          "description": "Material the parent read and wants the child to have. A separate member rather than something the parent pastes into 'text', so that material the parent obtained from a platform reaches the child still marked as material rather than as instruction the parent appears to have written."
        }
      }
    },
    "ChildJobLink": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "parentJobId",
        "childJobId",
        "assignment",
        "depth",
        "createdAt"
      ],
      "description": "The recorded fact that one job was created by an agent running another. One per child, and the only channel between a parent and a child (INV-JOB-08). A job record with no link is a top-level job, which is both the meaning of absence and the migration posture for every job written before this contract.",
      "properties": {
        "parentJobId": {
          "$ref": "#/$defs/JobId",
          "description": "The job whose agent created this one. The single field that distinguishes a child from any other job: it is queued, gated, recorded, recovered and cancelled by exactly the same machinery as a job the user created."
        },
        "childJobId": {
          "$ref": "#/$defs/JobId",
          "description": "The job that was created. A parent holds this identifier and reads the record it names; it never holds a reference to the running agent behind it."
        },
        "assignment": {
          "$ref": "#/$defs/ChildJobAssignment",
          "description": "What the child was given, held whole rather than decomposed, because the assignment is the unit that is validated and the unit that replicates. Splitting its text away from its quoted inputs would create a second place where the origin of external material is asserted."
        },
        "depth": {
          "const": 1,
          "description": "Always 1. Delegation is bounded at one level: a job holding a link may not create one. Expressing the bound as a constant means a grandchild is not a record this format can hold, rather than a case the runtime must remember to refuse. Raising the bound is a MINOR revision of the contract and a revision of this schema, and it needs its own evidence: the neighbouring measurement is spikes/SP-15-concurrency/REPORT.md section 1 Q4, where eight concurrent jobs against one connector account crossed into platform refusals at about five percent while three completed cleanly (VERIFIED), and depth multiplies against that budget. The bound itself is UNVERIFIED."
        },
        "createdAt": {
          "$ref": "#/$defs/Timestamp",
          "description": "When the link was written. The creation is itself a tool call, so a ledger record precedes it and carries the authoritative account of the step (principle III)."
        }
      }
    },
    "DelegationResult": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "childJobId",
        "roleId",
        "terminalState",
        "completedOperations",
        "finishedAt"
      ],
      "description": "What a parent reads when a child reaches a terminal state. Projected from the child's own job record rather than stored a second time, so that there is no copy that can go stale in the direction that tells a parent a failed child succeeded. Everything in it that a child wrote is external content (INV-JOB-09).",
      "properties": {
        "childJobId": {
          "$ref": "#/$defs/JobId",
          "description": "Which child this is the result of. The parent matches it against the identifiers its links name."
        },
        "roleId": {
          "$ref": "#/$defs/RoleId",
          "description": "The role the child ran under. Carried because the account of a run attributes spend and behaviour to a role, and a reader comparing three children's results needs to know they were not all the same kind of agent."
        },
        "terminalState": {
          "enum": [
            "done",
            "failed",
            "cancelled"
          ],
          "description": "The child's outcome. 'failed' and 'cancelled' are results, not the parent's failure: the parent remains able to continue and decides what to report, because a parent that died with its child would lose the account of the children that succeeded — and that account is what the undo offer is built from."
        },
        "report": {
          "$ref": "#/$defs/QuotedExternalContent",
          "description": "The child's account of its work. EXTERNAL CONTENT: it cannot authorise an operation, relax an approval decision, alter a rule or widen an allowlist, and a report stating that the user approved something grants exactly nothing. Optional, because a cancelled child may have had nothing to say."
        },
        "failureReason": {
          "$ref": "#/$defs/QuotedExternalContent",
          "description": "Why the child failed, present when it did. Also external content, because it may quote a platform's own words back at the parent."
        },
        "completedOperations": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/CompletedOperationRef"
          },
          "description": "What the child actually completed, by ledger reference rather than by the child's description of it. Empty is meaningful and common. This is the member that makes the parent's completed-operations list cover its children's writes, so that an undo offer after a parent's failure reaches the real changes rather than stopping at the parent's own calls."
        },
        "finishedAt": {
          "$ref": "#/$defs/Timestamp",
          "description": "When the child reached its terminal state. A parent returns from 'waiting_children' to 'running' once every child has one."
        }
      }
    },
    "CompletedOperationRef": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ledgerRecordId",
        "toolName",
        "connectorAccountId",
        "compensable"
      ],
      "description": "One operation a child completed, named by its ledger record. A reference rather than a copy: the ledger holds the snapshot and the compensating action, and this member exists only so a parent's account can reach them.",
      "properties": {
        "ledgerRecordId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128,
          "description": "The record in the append-only ledger, owned by ledger/contracts/ledger-record@0.1.0. It, not this projection, is the authority on what happened."
        },
        "toolName": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128,
          "description": "The tool the child called, so the operation can be presented to the user in the same words as the parent's own operations."
        },
        "connectorAccountId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 128,
          "description": "The connector account the call ran against. Carried because it is the key the concurrency budget uses: a child draws on the same per-account limit as every other job and never on a budget of its own (INV-JOB-10)."
        },
        "compensable": {
          "type": "boolean",
          "description": "False where the operation declared irreversible: true (principle IV). The undo offer says so rather than omitting the operation, because an operation silently missing from the list reads as an operation that did not happen."
        }
      }
    }
  }
} as const;
