/**
 * Normative shape of the manifest that makes a directory in the product's pack directory a capability pack, for agent/contracts/capability-pack@1.0.0. A pack is a source of declarations and never a second route to capability: every tool it declares is handed to the wrapping factory of agent/contracts/tool-wrapping@0.2.0 exactly as a connector adapter's tool is, so nothing here reaches the gate, the ledger obligation or a tool set except through that factory (INV-AG-44). The document is validated whole - a manifest that breaks any rule expressed in this file yields no tool, no role and no skill, because a half-applied pack is a tool set nobody reviewed. What this file cannot express is held by the contract document: that a declared role manifest and skill directory actually exist inside the pack, that a contributed tool name collides with nothing already registered, and whether the activation evidence a manifest names has in fact been recorded - the last of which is read from the device's activation relation rather than from this document, because activation is evidence-bound rather than authored.
 */
export interface CapabilityPackManifest {
  /**
   * Which revision of this manifest shape the document was written against. A manifest written for a major revision the build does not implement is refused whole and never read around, because reading around an unrecognised member means loading a tool set whose declarations were only partly understood.
   */
  schemaVersion: string;
  /**
   * Stable identity of the pack, unique within the product's pack directory. The activation relation, the record of which pack contributed a tool, and the report of a refused load all address the pack by it, so it does not change when the pack's content changes.
   */
  packId: string;
  /**
   * What the user sees where the product lists capabilities and states which are inactive and why.
   */
  name: string;
  /**
   * The pack content's own version, advanced by its author. Distinct from schemaVersion, which is the shape this document is written against rather than the content it carries.
   */
  version: string;
  /**
   * What the capability is, in one line, for the surface that tells the user an inactive capability exists and what would activate it.
   */
  description?: string;
  /**
   * Everything the pack adds to the runtime. All three members are required and may be empty: an empty list is the author stating that the pack contributes nothing of that kind, while an absent member is the author having not considered the question. While the pack is inactive none of these exists at all (INV-AG-45).
   */
  contributes: {
    /**
     * The tool declarations the pack hands to the wrapping factory. Each becomes a generated tool with the same ledger obligation, the same gate evaluation and the same allowlist treatment as a connector tool; the implementation itself is first-party code inside the pack and is deliberately outside this file, exactly as it is outside agent/contracts/tool-wrapping@0.2.0.
     *
     * Items: One contributed tool. The declaration block is the block the factory reads from a connector manifest, member for member, so that a reviewer comparing a pack's tool with a connector's tool is comparing like with like.
     */
    tools: {
      /**
       * The public tool name, unique across the tool set of one session. A name already held by the product, a connector or another pack refuses this pack whole rather than shadowing the existing tool, because a shadowed tool is a call the user believed went somewhere else.
       */
      name: string;
      /**
       * What the approval card calls this operation when the user is asked about it.
       */
      label?: string;
      /**
       * Shown to the model. Text only, with no capability of its own: nothing written here grants anything, because the verdict is taken outside everything a model reads or writes.
       */
      description: string;
      /**
       * Whether the tool changes state anywhere outside the product. A read tool carrying snapshot, compensation or irreversible is refused as a contradiction rather than silently reclassified.
       */
      direction: "read" | "write";
      /**
       * Whether the operation alters who may do what on the platform or system it acts against. Required on every tool because the gate reads it for every call, and a permission change nobody declared is the one write whose blast radius outlives the job.
       */
      changesPermission: boolean;
      /**
       * The shape a call is validated against before the wrapper runs.
       */
      parameters: {
        /**
         * Always the object type; a tool's arguments are named members, so that a rule and a snapshot can address one of them by path.
         */
        type: "object";
        /**
         * The named arguments, each with its own shape.
         */
        properties: {
          [k: string]: unknown;
        };
        /**
         * Which arguments a call must carry.
         *
         * Items: The name of an argument a call must carry.
         */
        required?: string[];
        [k: string]: unknown;
      };
      /**
       * What an interrupted call can say about itself. The vocabulary is owned by ledger/contracts/tool-reconciliation@0.1.0 and is referenced here rather than redefined.
       */
      reconciliation: {
        /**
         * How recovery establishes whether an interrupted call took effect: by reading the object back, or not at all.
         */
        method: "readback" | "none";
        /**
         * The read tool, declared by this same pack, that recovery calls to establish current state.
         */
        readOperation?: string;
        /**
         * What recovery does when the readback cannot decide. A pack whose effects cannot be read back at all says so here rather than leaving recovery to guess.
         */
        ambiguousOutcome?: "ask_user" | "treat_as_unperformed";
        [k: string]: unknown;
      };
      /**
       * How the state about to be changed is read before the change, so undo has something to replay a compensating action against. Required of every reversible write; a reversible write that cannot read its before state is refused at the call rather than performed unrecoverably.
       */
      snapshot?: {
        /**
         * A read tool this pack declares, called before the write to capture prior state.
         */
        readOperation: string;
        /**
         * Which argument of the call names the object whose prior state is read.
         */
        targetParam: string;
      };
      /**
       * The formula for building the reverse action: which tool undoes this one, and where its arguments come from. Write tools only, exclusive with irreversible, and requiring a snapshot. Undo replays this formula against current state and never reverts a diff (principle IV).
       */
      compensation?: {
        /**
         * The tool, declared by this same pack, whose call reverses this one.
         */
        tool: string;
        /**
         * Where the compensating call's arguments come from: the recorded prior state, or the result this call returned. Absent means snapshot. A creation has no prior state to build from, and result is the only honest answer for it.
         */
        argumentsSource?: "snapshot" | "result";
        /**
         * The path within the chosen source at which the compensating call's arguments are found.
         */
        argumentsFrom: string;
      };
      /**
       * Declares that nothing this pack can call reverses this operation. Write tools only, exclusive with compensation, and only the value true is expressible: declaring false is not a statement of reversibility but the silence principle IV forbids, and the reversible case is stated by supplying snapshot and compensation instead.
       */
      irreversible?: true;
    }[];
    /**
     * The role entries the pack adds to the registry when it activates. Each is a document inside the pack conforming to agent/contracts/role-registry@1.0.0; this manifest carries the reference rather than a second copy of the entry.
     *
     * Items: One contributed role entry, named here and authored in its own document.
     */
    roles: {
      /**
       * The identifier the entry will occupy in the registry. An identifier already held by a built-in entry refuses the pack whole: a built-in role is materialised by the product and is not a slot a pack may take.
       */
      roleId: string;
      /**
       * Where the role entry document lies, relative to the pack directory. The pattern admits neither an absolute path nor a parent-directory segment, so a pack cannot name a document it does not own; the shape is constrained here rather than checked after resolution, because a path is easier to refuse than a resolution is to audit.
       */
      manifest: string;
    }[];
    /**
     * The skill packages the pack adds to the catalogue when it activates. Each is a directory inside the pack holding a manifest conforming to agent/contracts/skill-manifest@1.0.0, discovered one level deep exactly as the product's own skill directory is.
     *
     * Items: One contributed skill package, named here and authored in its own directory.
     */
    skills: {
      /**
       * The identifier the package will advertise. Two packages declaring one identifier never merge: exactly one is selected by declared precedence and the other is recorded as shadowed (INV-AG-35).
       */
      skillId: string;
      /**
       * Where the skill package lies, relative to the pack directory. Constrained like every other path in this file: no absolute path, no parent-directory segment. A skill package carries content and never an executable artifact (INV-AG-34), so this directory is a place a model reads from and never a place the product runs.
       */
      directory: string;
    }[];
  };
  /**
   * What must be true before this pack's contributions exist at all. It is a declaration about evidence rather than a preference: no setting in the product turns a pack on, and no channel exists through which a window could. While the condition is unmet the pack contributes nothing - not a tool that refuses, not a role that cannot run, not a skill describing an impossibility (INV-AG-45).
   */
  activation: {
    /**
     * What must be established, in words the user can read when they ask why the product cannot do something. It names a measurement rather than a date or a release, because the capability waits on knowledge rather than on work.
     */
    condition: string;
    /**
     * The evidence that would satisfy the condition. Vendor documentation is never such evidence, so this member admits only a spike of this repository (Constitution, Evidence Discipline).
     */
    evidence: {
      /**
       * The spike identifier that would settle the condition. A proposed identifier is permitted, and is what an inactive pack ordinarily carries; it becomes a path only once the report exists.
       */
      spike: string;
      /**
       * Which part of the report answers the condition, in the form the project cites elsewhere, for example '1 Q2'. Absent while the spike is proposed, because a section of an unwritten report cannot be named honestly.
       */
      section?: string;
      /**
       * Whether the spike exists. 'proposed' means the measurement has been specified and not run; 'published' means a report is in the repository and can be read.
       */
      status: "proposed" | "published";
      /**
       * The report's path within the repository, required once the status is published. Relative and traversal-free like every path in this file.
       */
      reference?: string;
    };
    /**
     * What the pack's author states the current state to be. It is a claim rather than the authority: the loader reads the device's activation relation and treats a pack as active only where that relation records which evidence satisfied the condition. A manifest declaring active where no such row exists loads inactive, and the discrepancy is reported.
     */
    state: "inactive" | "active";
  };
  /**
   * Redaction classes this pack's tools introduce, in the vocabulary of agent/contracts/secret-redaction@1.0.0. A pack handling a kind of secret the product has not previously met declares it here; the reference form that replaces a value is closed and is not declarable, because a reference carrying anything derived from the value would be a reference that replicates the value (INV-AG-43).
   *
   * Items: One class of material that must not leave the wrapper in the clear.
   */
  secretClasses?: {
    /**
     * The class name that appears in the redacted reference standing where the value was.
     */
    className: string;
    /**
     * How the boundary recognises a value of this class. Declaration is an optimisation rather than the mechanism: an undeclared field matching a declared expression is still redacted, because an omission by a tool author must not become a disclosure.
     */
    recognisedBy: {
      /**
       * The argument and result paths this pack knows carry material of this class.
       *
       * Items: A field path within a tool's arguments or result, for example 'headers.authorization'.
       */
      fields?: string[];
      /**
       * An expression matched conservatively against values the pack's tools carry, for fields the author did not enumerate. Named valuePattern rather than pattern so that it is never mistaken for a constraint on this document.
       */
      valuePattern?: string;
    };
    /**
     * What this class of material is, for the reviewer deciding whether the recognition rules above are wide enough.
     */
    description?: string;
  }[];
  /**
   * The interception points this pack registers at, in the closed set owned by agent/contracts/runtime-lifecycle@1.0.0. Registration is fixed for the process lifetime - there is no hot reload, because a handler appearing mid-job would make the account of that job's calls inconsistent.
   *
   * Items: One registration. Note what cannot be declared here: the failure posture, which belongs to the point rather than to whoever registers at it, and any capacity to authorise, which exists at no point at all (INV-AG-40).
   */
  handlers?: {
    /**
     * Which of the six declared points the handler attaches to. The set is closed; the gate and the ledger write are steps of the wrapper and appear here deliberately not at all, so there is nothing for a registration to replace (INV-AG-41).
     */
    point:
      | "before-tool-call"
      | "after-tool-result"
      | "message-recorded"
      | "context-assembled"
      | "context-reduced"
      | "job-terminal";
    /**
     * The time the handler declares it needs, in milliseconds, enforced by the lifecycle bus. A handler exceeding it at the before-a-tool-call point causes the call to be refused; at any other point the handler is dropped and the failure recorded. No ceiling is fixed here, because none has been measured.
     */
    budgetMs: number;
    /**
     * Why this pack needs to stand at this point, for the reviewer reading the pack rather than for the runtime.
     */
    purpose: string;
  }[];
}


export const CAPABILITY_PACK_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/capability-pack/1.0.0.json",
  "title": "CapabilityPackManifest",
  "description": "Normative shape of the manifest that makes a directory in the product's pack directory a capability pack, for agent/contracts/capability-pack@1.0.0. A pack is a source of declarations and never a second route to capability: every tool it declares is handed to the wrapping factory of agent/contracts/tool-wrapping@0.2.0 exactly as a connector adapter's tool is, so nothing here reaches the gate, the ledger obligation or a tool set except through that factory (INV-AG-44). The document is validated whole - a manifest that breaks any rule expressed in this file yields no tool, no role and no skill, because a half-applied pack is a tool set nobody reviewed. What this file cannot express is held by the contract document: that a declared role manifest and skill directory actually exist inside the pack, that a contributed tool name collides with nothing already registered, and whether the activation evidence a manifest names has in fact been recorded - the last of which is read from the device's activation relation rather than from this document, because activation is evidence-bound rather than authored.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "packId",
    "name",
    "version",
    "contributes",
    "activation"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Which revision of this manifest shape the document was written against. A manifest written for a major revision the build does not implement is refused whole and never read around, because reading around an unrecognised member means loading a tool set whose declarations were only partly understood."
    },
    "packId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "Stable identity of the pack, unique within the product's pack directory. The activation relation, the record of which pack contributed a tool, and the report of a refused load all address the pack by it, so it does not change when the pack's content changes."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64,
      "description": "What the user sees where the product lists capabilities and states which are inactive and why."
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "The pack content's own version, advanced by its author. Distinct from schemaVersion, which is the shape this document is written against rather than the content it carries."
    },
    "description": {
      "type": "string",
      "maxLength": 300,
      "description": "What the capability is, in one line, for the surface that tells the user an inactive capability exists and what would activate it."
    },
    "contributes": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tools",
        "roles",
        "skills"
      ],
      "description": "Everything the pack adds to the runtime. All three members are required and may be empty: an empty list is the author stating that the pack contributes nothing of that kind, while an absent member is the author having not considered the question. While the pack is inactive none of these exists at all (INV-AG-45).",
      "properties": {
        "tools": {
          "type": "array",
          "uniqueItems": true,
          "description": "The tool declarations the pack hands to the wrapping factory. Each becomes a generated tool with the same ledger obligation, the same gate evaluation and the same allowlist treatment as a connector tool; the implementation itself is first-party code inside the pack and is deliberately outside this file, exactly as it is outside agent/contracts/tool-wrapping@0.2.0.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "description",
              "direction",
              "changesPermission",
              "parameters",
              "reconciliation"
            ],
            "description": "One contributed tool. The declaration block is the block the factory reads from a connector manifest, member for member, so that a reviewer comparing a pack's tool with a connector's tool is comparing like with like.",
            "properties": {
              "name": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]*$",
                "description": "The public tool name, unique across the tool set of one session. A name already held by the product, a connector or another pack refuses this pack whole rather than shadowing the existing tool, because a shadowed tool is a call the user believed went somewhere else."
              },
              "label": {
                "type": "string",
                "minLength": 1,
                "maxLength": 64,
                "description": "What the approval card calls this operation when the user is asked about it."
              },
              "description": {
                "type": "string",
                "minLength": 1,
                "description": "Shown to the model. Text only, with no capability of its own: nothing written here grants anything, because the verdict is taken outside everything a model reads or writes."
              },
              "direction": {
                "type": "string",
                "enum": [
                  "read",
                  "write"
                ],
                "description": "Whether the tool changes state anywhere outside the product. A read tool carrying snapshot, compensation or irreversible is refused as a contradiction rather than silently reclassified."
              },
              "changesPermission": {
                "type": "boolean",
                "description": "Whether the operation alters who may do what on the platform or system it acts against. Required on every tool because the gate reads it for every call, and a permission change nobody declared is the one write whose blast radius outlives the job."
              },
              "parameters": {
                "type": "object",
                "required": [
                  "type",
                  "properties"
                ],
                "description": "The shape a call is validated against before the wrapper runs.",
                "properties": {
                  "type": {
                    "const": "object",
                    "description": "Always the object type; a tool's arguments are named members, so that a rule and a snapshot can address one of them by path."
                  },
                  "properties": {
                    "type": "object",
                    "description": "The named arguments, each with its own shape."
                  },
                  "required": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "description": "The name of an argument a call must carry."
                    },
                    "description": "Which arguments a call must carry."
                  }
                }
              },
              "reconciliation": {
                "type": "object",
                "required": [
                  "method"
                ],
                "description": "What an interrupted call can say about itself. The vocabulary is owned by ledger/contracts/tool-reconciliation@0.1.0 and is referenced here rather than redefined.",
                "properties": {
                  "method": {
                    "type": "string",
                    "enum": [
                      "readback",
                      "none"
                    ],
                    "description": "How recovery establishes whether an interrupted call took effect: by reading the object back, or not at all."
                  },
                  "readOperation": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The read tool, declared by this same pack, that recovery calls to establish current state."
                  },
                  "ambiguousOutcome": {
                    "type": "string",
                    "enum": [
                      "ask_user",
                      "treat_as_unperformed"
                    ],
                    "description": "What recovery does when the readback cannot decide. A pack whose effects cannot be read back at all says so here rather than leaving recovery to guess."
                  }
                }
              },
              "snapshot": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "readOperation",
                  "targetParam"
                ],
                "description": "How the state about to be changed is read before the change, so undo has something to replay a compensating action against. Required of every reversible write; a reversible write that cannot read its before state is refused at the call rather than performed unrecoverably.",
                "properties": {
                  "readOperation": {
                    "type": "string",
                    "minLength": 1,
                    "description": "A read tool this pack declares, called before the write to capture prior state."
                  },
                  "targetParam": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Which argument of the call names the object whose prior state is read."
                  }
                }
              },
              "compensation": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "tool",
                  "argumentsFrom"
                ],
                "description": "The formula for building the reverse action: which tool undoes this one, and where its arguments come from. Write tools only, exclusive with irreversible, and requiring a snapshot. Undo replays this formula against current state and never reverts a diff (principle IV).",
                "properties": {
                  "tool": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The tool, declared by this same pack, whose call reverses this one."
                  },
                  "argumentsSource": {
                    "type": "string",
                    "enum": [
                      "snapshot",
                      "result"
                    ],
                    "description": "Where the compensating call's arguments come from: the recorded prior state, or the result this call returned. Absent means snapshot. A creation has no prior state to build from, and result is the only honest answer for it."
                  },
                  "argumentsFrom": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The path within the chosen source at which the compensating call's arguments are found."
                  }
                }
              },
              "irreversible": {
                "type": "boolean",
                "const": true,
                "description": "Declares that nothing this pack can call reverses this operation. Write tools only, exclusive with compensation, and only the value true is expressible: declaring false is not a statement of reversibility but the silence principle IV forbids, and the reversible case is stated by supplying snapshot and compensation instead."
              }
            },
            "allOf": [
              {
                "if": {
                  "properties": {
                    "direction": {
                      "const": "write"
                    }
                  },
                  "required": [
                    "direction"
                  ]
                },
                "then": {
                  "oneOf": [
                    {
                      "required": [
                        "compensation"
                      ],
                      "not": {
                        "required": [
                          "irreversible"
                        ]
                      }
                    },
                    {
                      "required": [
                        "irreversible"
                      ],
                      "not": {
                        "required": [
                          "compensation"
                        ]
                      }
                    }
                  ]
                }
              },
              {
                "if": {
                  "required": [
                    "compensation"
                  ]
                },
                "then": {
                  "required": [
                    "snapshot"
                  ]
                }
              },
              {
                "if": {
                  "properties": {
                    "direction": {
                      "const": "read"
                    }
                  },
                  "required": [
                    "direction"
                  ]
                },
                "then": {
                  "allOf": [
                    {
                      "not": {
                        "required": [
                          "snapshot"
                        ]
                      }
                    },
                    {
                      "not": {
                        "required": [
                          "compensation"
                        ]
                      }
                    },
                    {
                      "not": {
                        "required": [
                          "irreversible"
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        "roles": {
          "type": "array",
          "uniqueItems": true,
          "description": "The role entries the pack adds to the registry when it activates. Each is a document inside the pack conforming to agent/contracts/role-registry@1.0.0; this manifest carries the reference rather than a second copy of the entry.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "roleId",
              "manifest"
            ],
            "description": "One contributed role entry, named here and authored in its own document.",
            "properties": {
              "roleId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9-]{1,62}$",
                "description": "The identifier the entry will occupy in the registry. An identifier already held by a built-in entry refuses the pack whole: a built-in role is materialised by the product and is not a slot a pack may take."
              },
              "manifest": {
                "type": "string",
                "pattern": "^(?!\\.\\.?$)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$",
                "description": "Where the role entry document lies, relative to the pack directory. The pattern admits neither an absolute path nor a parent-directory segment, so a pack cannot name a document it does not own; the shape is constrained here rather than checked after resolution, because a path is easier to refuse than a resolution is to audit."
              }
            }
          }
        },
        "skills": {
          "type": "array",
          "uniqueItems": true,
          "description": "The skill packages the pack adds to the catalogue when it activates. Each is a directory inside the pack holding a manifest conforming to agent/contracts/skill-manifest@1.0.0, discovered one level deep exactly as the product's own skill directory is.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "skillId",
              "directory"
            ],
            "description": "One contributed skill package, named here and authored in its own directory.",
            "properties": {
              "skillId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9-]{1,62}$",
                "description": "The identifier the package will advertise. Two packages declaring one identifier never merge: exactly one is selected by declared precedence and the other is recorded as shadowed (INV-AG-35)."
              },
              "directory": {
                "type": "string",
                "pattern": "^(?!\\.\\.?$)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$",
                "description": "Where the skill package lies, relative to the pack directory. Constrained like every other path in this file: no absolute path, no parent-directory segment. A skill package carries content and never an executable artifact (INV-AG-34), so this directory is a place a model reads from and never a place the product runs."
              }
            }
          }
        }
      }
    },
    "activation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "condition",
        "evidence",
        "state"
      ],
      "description": "What must be true before this pack's contributions exist at all. It is a declaration about evidence rather than a preference: no setting in the product turns a pack on, and no channel exists through which a window could. While the condition is unmet the pack contributes nothing - not a tool that refuses, not a role that cannot run, not a skill describing an impossibility (INV-AG-45).",
      "properties": {
        "condition": {
          "type": "string",
          "minLength": 1,
          "maxLength": 600,
          "description": "What must be established, in words the user can read when they ask why the product cannot do something. It names a measurement rather than a date or a release, because the capability waits on knowledge rather than on work."
        },
        "evidence": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "spike",
            "status"
          ],
          "description": "The evidence that would satisfy the condition. Vendor documentation is never such evidence, so this member admits only a spike of this repository (Constitution, Evidence Discipline).",
          "properties": {
            "spike": {
              "type": "string",
              "pattern": "^SP-\\d{1,3}$",
              "description": "The spike identifier that would settle the condition. A proposed identifier is permitted, and is what an inactive pack ordinarily carries; it becomes a path only once the report exists."
            },
            "section": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120,
              "description": "Which part of the report answers the condition, in the form the project cites elsewhere, for example '1 Q2'. Absent while the spike is proposed, because a section of an unwritten report cannot be named honestly."
            },
            "status": {
              "type": "string",
              "enum": [
                "proposed",
                "published"
              ],
              "description": "Whether the spike exists. 'proposed' means the measurement has been specified and not run; 'published' means a report is in the repository and can be read."
            },
            "reference": {
              "type": "string",
              "pattern": "^(?!\\.\\.?$)(?!.*(?:^|/)\\.\\.(?:/|$))[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$",
              "description": "The report's path within the repository, required once the status is published. Relative and traversal-free like every path in this file."
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "status": {
                    "const": "published"
                  }
                },
                "required": [
                  "status"
                ]
              },
              "then": {
                "required": [
                  "reference",
                  "section"
                ]
              }
            }
          ]
        },
        "state": {
          "type": "string",
          "enum": [
            "inactive",
            "active"
          ],
          "description": "What the pack's author states the current state to be. It is a claim rather than the authority: the loader reads the device's activation relation and treats a pack as active only where that relation records which evidence satisfied the condition. A manifest declaring active where no such row exists loads inactive, and the discrepancy is reported."
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "state": {
                "const": "active"
              }
            },
            "required": [
              "state"
            ]
          },
          "then": {
            "properties": {
              "evidence": {
                "properties": {
                  "status": {
                    "const": "published"
                  }
                },
                "required": [
                  "status"
                ]
              }
            },
            "required": [
              "evidence"
            ]
          }
        }
      ]
    },
    "secretClasses": {
      "type": "array",
      "uniqueItems": true,
      "description": "Redaction classes this pack's tools introduce, in the vocabulary of agent/contracts/secret-redaction@1.0.0. A pack handling a kind of secret the product has not previously met declares it here; the reference form that replaces a value is closed and is not declarable, because a reference carrying anything derived from the value would be a reference that replicates the value (INV-AG-43).",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "className",
          "recognisedBy"
        ],
        "description": "One class of material that must not leave the wrapper in the clear.",
        "properties": {
          "className": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{1,62}$",
            "description": "The class name that appears in the redacted reference standing where the value was."
          },
          "recognisedBy": {
            "type": "object",
            "additionalProperties": false,
            "description": "How the boundary recognises a value of this class. Declaration is an optimisation rather than the mechanism: an undeclared field matching a declared expression is still redacted, because an omission by a tool author must not become a disclosure.",
            "properties": {
              "fields": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "description": "A field path within a tool's arguments or result, for example 'headers.authorization'."
                },
                "description": "The argument and result paths this pack knows carry material of this class."
              },
              "valuePattern": {
                "type": "string",
                "minLength": 1,
                "description": "An expression matched conservatively against values the pack's tools carry, for fields the author did not enumerate. Named valuePattern rather than pattern so that it is never mistaken for a constraint on this document."
              }
            }
          },
          "description": {
            "type": "string",
            "maxLength": 300,
            "description": "What this class of material is, for the reviewer deciding whether the recognition rules above are wide enough."
          }
        }
      }
    },
    "handlers": {
      "type": "array",
      "uniqueItems": true,
      "description": "The interception points this pack registers at, in the closed set owned by agent/contracts/runtime-lifecycle@1.0.0. Registration is fixed for the process lifetime - there is no hot reload, because a handler appearing mid-job would make the account of that job's calls inconsistent.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "point",
          "budgetMs",
          "purpose"
        ],
        "description": "One registration. Note what cannot be declared here: the failure posture, which belongs to the point rather than to whoever registers at it, and any capacity to authorise, which exists at no point at all (INV-AG-40).",
        "properties": {
          "point": {
            "type": "string",
            "enum": [
              "before-tool-call",
              "after-tool-result",
              "message-recorded",
              "context-assembled",
              "context-reduced",
              "job-terminal"
            ],
            "description": "Which of the six declared points the handler attaches to. The set is closed; the gate and the ledger write are steps of the wrapper and appear here deliberately not at all, so there is nothing for a registration to replace (INV-AG-41)."
          },
          "budgetMs": {
            "type": "integer",
            "minimum": 1,
            "description": "The time the handler declares it needs, in milliseconds, enforced by the lifecycle bus. A handler exceeding it at the before-a-tool-call point causes the call to be refused; at any other point the handler is dropped and the failure recorded. No ceiling is fixed here, because none has been measured."
          },
          "purpose": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300,
            "description": "Why this pack needs to stand at this point, for the reviewer reading the pack rather than for the runtime."
          }
        }
      }
    }
  }
} as const;
