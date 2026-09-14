/**
 * Normative shape of a stored agent transcript for agent/contracts/agent-session@1.0.0. This is the artifact, not the live session: it is what the transcript store holds, what replicates to the account, and what a rebuilt session is constructed from. The equivalence that makes resume one behaviour rather than two rests on it - a fresh session built from these turns must produce the same next step as the live session that wrote them (INV-AG-06). A transcript is also the only explanation a user has of what an agent did, which is why a reader meeting a content kind it does not know renders it as an unreadable turn and never drops it. Revised from 0.1.0 in exactly two ways. (1) 'role' was a closed union of four values and is now the identifier of an entry in agent/contracts/role-registry@1.0.0, so a session can run under a role the product never shipped; this file constrains the FORM of that identifier and stops there, because whether an entry exists for it is the registry's question, asked before a session is constructed. (2) Three additive members record what the session was given before it began: 'parentJobId', the job whose agent created this one's job, and 'context', the account of the budget it was built against and the skills that were loaded. Absence of the additive members is meaningful and defined: a transcript written before this revision has no lineage and no account, and is read as a top-level job whose account was not recorded - never as a session with no budget, and never by substituting a figure afterwards. Stored transcripts are never rewritten; the reading side does the translation.
 */
export interface Transcript {
  /**
   * Identity of the one running agent this conversation belongs to. Stable across a rebuild: a session reconstructed from these turns is the same session, not a successor to it.
   */
  sessionId: string;
  /**
   * The job this session serves. One job has one live session (INV-AG-04), which is what makes the suspension point below unambiguous enough for a decision to be applied to it.
   */
  jobId: string;
  /**
   * Added at 1.0.0. The job whose agent created this session's job, present exactly when this job is a child and absent when it is top-level. It is a recorded fact about jobs and never a channel between agents: a session holds no handle to another session, and the pair of job records is the whole of what connects a parent to a child (INV-JOB-08, principle I). Never equal to jobId. What a parent may create, how deep and how wide, belongs to agent/contracts/job-delegation@1.0.0; this file records the outcome of those rules and enforces none of them. A transcript written before 1.0.0 has no such member and reads as a top-level job.
   */
  parentJobId?: string;
  /**
   * Revised at 1.0.0: was the closed union pet | worker | rule_elicitation | undo, and is now a role identifier resolved through agent/contracts/role-registry@1.0.0. Same member, same string type, different provenance - which is the whole reason this revision is MAJOR, because a reader can no longer switch exhaustively on four values. The identifier is resolved once at construction and is immutable for the life of the session: a registry edited mid-run does not reach a running session, and the tool allowlist the entry yields is resolved with it and frozen (INV-AG-33). A transcript whose role no longer resolves is still displayed under the identifier it was written with; only a rebuild is refused, by the registry, with ROLE_UNKNOWN. Old stored values read as their built-in identifiers: pet as pet-text (or pet-image where the user turn carries images, which is the split 0.1.0 made at routing time), worker as worker, rule_elicitation as rule-elicitation, undo as undo.
   */
  role: string;
  /**
   * Added at 1.0.0. The account of the context this session was given - never the context itself, which is assembled per request and is never persisted (INV-AG-37). The account is stored precisely because the context is not: a run investigated later must be judged against the budget it actually had and the playbooks it actually read, and neither is recoverable from the turns. Reduction acts only on what is sent to a model and never rewrites this transcript (INV-AG-38). Absent in a transcript written before 1.0.0, which reads as a session that recorded no account rather than one that had no budget; a reader shows the absence and never substitutes a figure of its own.
   */
  context?: {
    /**
     * The context budget the job was given, recorded when the job started. The derivation of the ceiling and the point at which reduction begins are product choices with no measurement behind them - UNVERIFIED, recorded as Q-4 in clarifications.md session 2026-09-13. Recorded, not negotiated: a session receives this figure and does not decide one, and a context that already exceeds it before the first turn stops the job in agent/contracts/context-assembly@1.0.0.
     */
    budget: {
      /**
       * Tokens this job may spend on one assembled context.
       */
      ceiling: number;
      /**
       * Tokens below the ceiling at which the declared reduction ladder begins. Zero is permitted and means reduction begins at the ceiling itself.
       */
      reserve: number;
      /**
       * Whether the ceiling was derived from the assigned model's declared context window, or taken from the declared fallback because the profile declares no window for that model. Recorded rather than inferred, because a fallback figure and a derived one are the same number to a reader who cannot tell them apart.
       */
      basis: "derived" | "fallback";
      /**
       * The declared context window the ceiling was derived from. Present when basis is derived; absent when it is fallback, since there was no window to derive from.
       */
      modelWindow?: number;
    };
    /**
     * The skill packages whose bodies were placed in this session's context, in the order they arrived. An empty array is meaningful: a session that loaded none. The load-on-demand shape follows the reference architecture, which advertises a skill's description and loads its body when the work matches (https://omp.sh/docs/skills, UNVERIFIED); it is re-implemented against the pinned harness and nothing is imported.
     *
     * Items: One loaded skill, and the point at which it entered the context.
     */
    skills: {
      /**
       * The skill identifier, as agent/contracts/skill-manifest@1.0.0 declares it. The body itself is not recorded here: this is the account of what was loaded, not a copy of it.
       */
      skillId: string;
      /**
       * Whether the role entry named this skill to preload, or the job's work matched its applicability. Recorded because the two are answerable differently when a run went wrong: one is a property of the role, the other of this job.
       */
      reason: "preloaded" | "matched";
      /**
       * The transcript position from which the skill was in context. Zero means it was present before the first turn. A position rather than a clock reading, for the same reason turns order by position: 'at' is displayed and never used to order.
       */
      atPosition: number;
    }[];
  };
  /**
   * Append-only within a run, with dense and strictly increasing positions (INV-AG-03). That positions are dense, unique and increasing is a relation between turns rather than a property of one, so it is held by the store and by the session rather than by this file.
   *
   * Items: One entry in the conversation. It carries its own author and content kind so that a turn written by an older build is read as it was written and rendered under the shape it declares, which is what lets stored transcripts be translated on read rather than rewritten.
   */
  turns: {
    /**
     * The turn's place in the conversation. Dense, unique and strictly increasing within the transcript; this is the ordering, and the only one.
     */
    position: number;
    /**
     * Who produced the turn. Removing a member, or changing what one means, is MAJOR: a reader renders the conversation from this.
     */
    author: "user" | "agent" | "tool_result" | "reasoning";
    /**
     * ISO-8601. Displayed, never used to order: ordering is position within the transcript.
     */
    at: string;
    /**
     * Read from the provider response, never estimated - VERIFIED (spikes/SP-6-pi-sdk/REPORT.md section 1 Q7). Present on agent turns only. What is shown and what it costs belong to req-017-provider-matrix.
     */
    usage?: {
      /**
       * Input tokens the provider reported for this turn.
       */
      input: number;
      /**
       * Output tokens the provider reported for this turn.
       */
      output: number;
      /**
       * Reasoning tokens the provider reported; zero where the model reports none.
       */
      reasoning: number;
      /**
       * The provider's own total for this turn, carried as reported rather than recomputed.
       */
      total: number;
    };
    /**
     * The closed set of things a turn can carry. A kind added at a later MINOR is rendered by an older reader as an unreadable turn rather than omitted, because silently omitting one would show a user a conversation that never happened.
     */
    content:
      | {
          /**
           * Discriminator for a text turn.
           */
          kind: "text";
          /**
           * The text itself. External content carried here is data and never instruction (constitution, External Content Is Data).
           */
          text: string;
        }
      | {
          /**
           * Discriminator for an image-bearing turn.
           */
          kind: "images";
          /**
           * Text the user sent alongside the images. Optional: an image may arrive with no words.
           */
          text?: string;
          /**
           * The attached images. At least one, since the kind exists to carry them; at most three, the ceiling uix declares for one command.
           *
           * @minItems 1
           * @maxItems 3
           *
           * Items: Carried as content in the turn rather than as a path, so the transcript is self-contained. Released when the job reaches a terminal state (INV-AG-10); a window never receives this payload.
           */
          images:
            | [
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                }
              ]
            | [
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                },
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                }
              ]
            | [
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                },
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                },
                {
                  /**
                   * The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone.
                   */
                  data: string;
                  /**
                   * The image's media type, as accepted by the provider profile's declared image capability.
                   */
                  mimeType: string;
                  /**
                   * Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read.
                   */
                  width: number;
                  /**
                   * Pixel height; the same floor, for the same reason.
                   */
                  height: number;
                  /**
                   * Size of the image in bytes, at most 10 MB.
                   */
                  bytes: number;
                }
              ];
        }
      | {
          /**
           * Discriminator for a tool-call turn.
           */
          kind: "tool_calls";
          /**
           * The calls issued in this turn. At least one, since an empty call turn is a turn that did nothing.
           *
           * @minItems 1
           *
           * Items: One tool call, correlated with its ledger records and with whatever answers it.
           */
          calls: [
            {
              /**
               * The same identifier the ledger uses to correlate the intent and the result of this call (INV-AG-05).
               */
              callId: string;
              /**
               * The generated tool's name, as the wrapping factory produced it and as the role entry's allowlist admitted it.
               */
              tool: string;
              /**
               * The arguments as issued. Values of a declared secret class appear here as redacted references, because every value leaving the wrapper crosses the redaction boundary exactly once (INV-AG-42).
               */
              arguments: {
                [k: string]: unknown;
              };
            },
            ...{
              /**
               * The same identifier the ledger uses to correlate the intent and the result of this call (INV-AG-05).
               */
              callId: string;
              /**
               * The generated tool's name, as the wrapping factory produced it and as the role entry's allowlist admitted it.
               */
              tool: string;
              /**
               * The arguments as issued. Values of a declared secret class appear here as redacted references, because every value leaving the wrapper crosses the redaction boundary exactly once (INV-AG-42).
               */
              arguments: {
                [k: string]: unknown;
              };
            }[]
          ];
        }
      | {
          /**
           * Discriminator for a tool-result turn.
           */
          kind: "tool_result";
          /**
           * The call this answers. Exactly one turn answers a given callId.
           */
          callId: string;
          /**
           * What the tool returned, after the redaction boundary projected it. Any JSON value: the shape belongs to the tool, not to this file.
           */
          result: {
            [k: string]: unknown;
          };
        }
      | {
          /**
           * Discriminator for a refusal turn.
           */
          kind: "tool_refused";
          /**
           * The call that was refused. A refusal answers a call exactly as a result does.
           */
          callId: string;
          /**
           * Why it was refused, in the words the user is shown.
           */
          reason: string;
          /**
           * The rule that refused it, so the refusal can be traced to the declaration that caused it rather than to a model's choice.
           */
          ruleId: string;
        }
      | {
          /**
           * Discriminator for a redaction marker.
           */
          kind: "redacted";
          /**
           * Why the turn is gone: the retention floor expired it, or the user deleted it.
           */
          reason: "retention" | "user_deletion";
          /**
           * The position the removed turn occupied, which this marker now occupies, so positions stay dense.
           */
          replacedPosition: number;
        };
  }[];
  /**
   * Where a run stopped. Present exactly while the run is suspended. Written durably, and the job moved to waiting, before the approval request reaches any surface - which is what makes an abrupt stop uninteresting. A transcript carrying a suspension whose call already has a result turn is a run that executed a held call; that is a relation between turns, so the store refuses it rather than this file.
   */
  suspension?: {
    /**
     * What the run is waiting for: a decision on a held call, or an answer to an open question.
     */
    reason: "awaiting_approval" | "awaiting_answer";
    /**
     * The ledger correlation identifier of the held call (INV-AG-05). At this point the ledger holds an intent for it and no result.
     */
    callId: string;
    /**
     * The approval request, or the open question, that satisfying this suspension answers.
     */
    requestId: string;
    /**
     * The turn the run stops after. Both resume paths continue from here, which is what makes them one behaviour - VERIFIED (spikes/SP-6-pi-sdk/REPORT.md section 1 Q3).
     */
    atPosition: number;
    /**
     * ISO-8601 instant the run suspended. Displayed; the suspension does not expire by itself.
     */
    since: string;
  };
}


export const AGENT_SESSION_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/agent-session/1.0.0.json",
  "title": "Transcript",
  "description": "Normative shape of a stored agent transcript for agent/contracts/agent-session@1.0.0. This is the artifact, not the live session: it is what the transcript store holds, what replicates to the account, and what a rebuilt session is constructed from. The equivalence that makes resume one behaviour rather than two rests on it - a fresh session built from these turns must produce the same next step as the live session that wrote them (INV-AG-06). A transcript is also the only explanation a user has of what an agent did, which is why a reader meeting a content kind it does not know renders it as an unreadable turn and never drops it. Revised from 0.1.0 in exactly two ways. (1) 'role' was a closed union of four values and is now the identifier of an entry in agent/contracts/role-registry@1.0.0, so a session can run under a role the product never shipped; this file constrains the FORM of that identifier and stops there, because whether an entry exists for it is the registry's question, asked before a session is constructed. (2) Three additive members record what the session was given before it began: 'parentJobId', the job whose agent created this one's job, and 'context', the account of the budget it was built against and the skills that were loaded. Absence of the additive members is meaningful and defined: a transcript written before this revision has no lineage and no account, and is read as a top-level job whose account was not recorded - never as a session with no budget, and never by substituting a figure afterwards. Stored transcripts are never rewritten; the reading side does the translation.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "sessionId",
    "jobId",
    "role",
    "turns"
  ],
  "properties": {
    "sessionId": {
      "type": "string",
      "minLength": 1,
      "description": "Identity of the one running agent this conversation belongs to. Stable across a rebuild: a session reconstructed from these turns is the same session, not a successor to it."
    },
    "jobId": {
      "type": "string",
      "minLength": 1,
      "description": "The job this session serves. One job has one live session (INV-AG-04), which is what makes the suspension point below unambiguous enough for a decision to be applied to it."
    },
    "parentJobId": {
      "type": "string",
      "minLength": 1,
      "description": "Added at 1.0.0. The job whose agent created this session's job, present exactly when this job is a child and absent when it is top-level. It is a recorded fact about jobs and never a channel between agents: a session holds no handle to another session, and the pair of job records is the whole of what connects a parent to a child (INV-JOB-08, principle I). Never equal to jobId. What a parent may create, how deep and how wide, belongs to agent/contracts/job-delegation@1.0.0; this file records the outcome of those rules and enforces none of them. A transcript written before 1.0.0 has no such member and reads as a top-level job."
    },
    "role": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$",
      "description": "Revised at 1.0.0: was the closed union pet | worker | rule_elicitation | undo, and is now a role identifier resolved through agent/contracts/role-registry@1.0.0. Same member, same string type, different provenance - which is the whole reason this revision is MAJOR, because a reader can no longer switch exhaustively on four values. The identifier is resolved once at construction and is immutable for the life of the session: a registry edited mid-run does not reach a running session, and the tool allowlist the entry yields is resolved with it and frozen (INV-AG-33). A transcript whose role no longer resolves is still displayed under the identifier it was written with; only a rebuild is refused, by the registry, with ROLE_UNKNOWN. Old stored values read as their built-in identifiers: pet as pet-text (or pet-image where the user turn carries images, which is the split 0.1.0 made at routing time), worker as worker, rule_elicitation as rule-elicitation, undo as undo."
    },
    "context": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "budget",
        "skills"
      ],
      "description": "Added at 1.0.0. The account of the context this session was given - never the context itself, which is assembled per request and is never persisted (INV-AG-37). The account is stored precisely because the context is not: a run investigated later must be judged against the budget it actually had and the playbooks it actually read, and neither is recoverable from the turns. Reduction acts only on what is sent to a model and never rewrites this transcript (INV-AG-38). Absent in a transcript written before 1.0.0, which reads as a session that recorded no account rather than one that had no budget; a reader shows the absence and never substitutes a figure of its own.",
      "properties": {
        "budget": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "ceiling",
            "reserve",
            "basis"
          ],
          "description": "The context budget the job was given, recorded when the job started. The derivation of the ceiling and the point at which reduction begins are product choices with no measurement behind them - UNVERIFIED, recorded as Q-4 in clarifications.md session 2026-09-13. Recorded, not negotiated: a session receives this figure and does not decide one, and a context that already exceeds it before the first turn stops the job in agent/contracts/context-assembly@1.0.0.",
          "properties": {
            "ceiling": {
              "type": "integer",
              "minimum": 1,
              "description": "Tokens this job may spend on one assembled context."
            },
            "reserve": {
              "type": "integer",
              "minimum": 0,
              "description": "Tokens below the ceiling at which the declared reduction ladder begins. Zero is permitted and means reduction begins at the ceiling itself."
            },
            "basis": {
              "enum": [
                "derived",
                "fallback"
              ],
              "description": "Whether the ceiling was derived from the assigned model's declared context window, or taken from the declared fallback because the profile declares no window for that model. Recorded rather than inferred, because a fallback figure and a derived one are the same number to a reader who cannot tell them apart."
            },
            "modelWindow": {
              "type": "integer",
              "minimum": 1,
              "description": "The declared context window the ceiling was derived from. Present when basis is derived; absent when it is fallback, since there was no window to derive from."
            }
          },
          "allOf": [
            {
              "if": {
                "properties": {
                  "basis": {
                    "const": "fallback"
                  }
                },
                "required": [
                  "basis"
                ]
              },
              "then": {
                "not": {
                  "required": [
                    "modelWindow"
                  ]
                }
              }
            }
          ]
        },
        "skills": {
          "type": "array",
          "description": "The skill packages whose bodies were placed in this session's context, in the order they arrived. An empty array is meaningful: a session that loaded none. The load-on-demand shape follows the reference architecture, which advertises a skill's description and loads its body when the work matches (https://omp.sh/docs/skills, UNVERIFIED); it is re-implemented against the pinned harness and nothing is imported.",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "skillId",
              "reason",
              "atPosition"
            ],
            "description": "One loaded skill, and the point at which it entered the context.",
            "properties": {
              "skillId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9-]{1,62}$",
                "description": "The skill identifier, as agent/contracts/skill-manifest@1.0.0 declares it. The body itself is not recorded here: this is the account of what was loaded, not a copy of it."
              },
              "reason": {
                "enum": [
                  "preloaded",
                  "matched"
                ],
                "description": "Whether the role entry named this skill to preload, or the job's work matched its applicability. Recorded because the two are answerable differently when a run went wrong: one is a property of the role, the other of this job."
              },
              "atPosition": {
                "type": "integer",
                "minimum": 0,
                "description": "The transcript position from which the skill was in context. Zero means it was present before the first turn. A position rather than a clock reading, for the same reason turns order by position: 'at' is displayed and never used to order."
              }
            }
          }
        }
      }
    },
    "turns": {
      "type": "array",
      "description": "Append-only within a run, with dense and strictly increasing positions (INV-AG-03). That positions are dense, unique and increasing is a relation between turns rather than a property of one, so it is held by the store and by the session rather than by this file.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "position",
          "author",
          "content",
          "at"
        ],
        "description": "One entry in the conversation. It carries its own author and content kind so that a turn written by an older build is read as it was written and rendered under the shape it declares, which is what lets stored transcripts be translated on read rather than rewritten.",
        "properties": {
          "position": {
            "type": "integer",
            "minimum": 1,
            "description": "The turn's place in the conversation. Dense, unique and strictly increasing within the transcript; this is the ordering, and the only one."
          },
          "author": {
            "enum": [
              "user",
              "agent",
              "tool_result",
              "reasoning"
            ],
            "description": "Who produced the turn. Removing a member, or changing what one means, is MAJOR: a reader renders the conversation from this."
          },
          "at": {
            "type": "string",
            "minLength": 1,
            "description": "ISO-8601. Displayed, never used to order: ordering is position within the transcript."
          },
          "usage": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "input",
              "output",
              "reasoning",
              "total"
            ],
            "description": "Read from the provider response, never estimated - VERIFIED (spikes/SP-6-pi-sdk/REPORT.md section 1 Q7). Present on agent turns only. What is shown and what it costs belong to req-017-provider-matrix.",
            "properties": {
              "input": {
                "type": "integer",
                "minimum": 0,
                "description": "Input tokens the provider reported for this turn."
              },
              "output": {
                "type": "integer",
                "minimum": 0,
                "description": "Output tokens the provider reported for this turn."
              },
              "reasoning": {
                "type": "integer",
                "minimum": 0,
                "description": "Reasoning tokens the provider reported; zero where the model reports none."
              },
              "total": {
                "type": "integer",
                "minimum": 0,
                "description": "The provider's own total for this turn, carried as reported rather than recomputed."
              }
            }
          },
          "content": {
            "description": "The closed set of things a turn can carry. A kind added at a later MINOR is rendered by an older reader as an unreadable turn rather than omitted, because silently omitting one would show a user a conversation that never happened.",
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "text"
                ],
                "description": "Plain text: a user's command, or an agent's message.",
                "properties": {
                  "kind": {
                    "const": "text",
                    "description": "Discriminator for a text turn."
                  },
                  "text": {
                    "type": "string",
                    "description": "The text itself. External content carried here is data and never instruction (constitution, External Content Is Data)."
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "images"
                ],
                "description": "A user turn carrying attached images, with optional accompanying text.",
                "properties": {
                  "kind": {
                    "const": "images",
                    "description": "Discriminator for an image-bearing turn."
                  },
                  "text": {
                    "type": "string",
                    "description": "Text the user sent alongside the images. Optional: an image may arrive with no words."
                  },
                  "images": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 3,
                    "description": "The attached images. At least one, since the kind exists to carry them; at most three, the ceiling uix declares for one command.",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "data",
                        "mimeType",
                        "width",
                        "height",
                        "bytes"
                      ],
                      "description": "Carried as content in the turn rather than as a path, so the transcript is self-contained. Released when the job reaches a terminal state (INV-AG-10); a window never receives this payload.",
                      "properties": {
                        "data": {
                          "type": "string",
                          "minLength": 1,
                          "description": "The image itself, carried inline rather than referenced, so a transcript does not depend on a file that may be gone."
                        },
                        "mimeType": {
                          "type": "string",
                          "minLength": 1,
                          "description": "The image's media type, as accepted by the provider profile's declared image capability."
                        },
                        "width": {
                          "type": "integer",
                          "minimum": 14,
                          "description": "Pixel width; at least 14, the floor specs/uix sets for something a model can be asked to read."
                        },
                        "height": {
                          "type": "integer",
                          "minimum": 14,
                          "description": "Pixel height; the same floor, for the same reason."
                        },
                        "bytes": {
                          "type": "integer",
                          "minimum": 1,
                          "maximum": 10485760,
                          "description": "Size of the image in bytes, at most 10 MB."
                        }
                      }
                    }
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "calls"
                ],
                "description": "An agent turn issuing one or more tool calls. Every tool here was produced by the wrapping factory (INV-AG-01) and is answered exactly once, by a result or by a refusal.",
                "properties": {
                  "kind": {
                    "const": "tool_calls",
                    "description": "Discriminator for a tool-call turn."
                  },
                  "calls": {
                    "type": "array",
                    "minItems": 1,
                    "description": "The calls issued in this turn. At least one, since an empty call turn is a turn that did nothing.",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "callId",
                        "tool",
                        "arguments"
                      ],
                      "description": "One tool call, correlated with its ledger records and with whatever answers it.",
                      "properties": {
                        "callId": {
                          "type": "string",
                          "minLength": 1,
                          "description": "The same identifier the ledger uses to correlate the intent and the result of this call (INV-AG-05)."
                        },
                        "tool": {
                          "type": "string",
                          "minLength": 1,
                          "description": "The generated tool's name, as the wrapping factory produced it and as the role entry's allowlist admitted it."
                        },
                        "arguments": {
                          "type": "object",
                          "description": "The arguments as issued. Values of a declared secret class appear here as redacted references, because every value leaving the wrapper crosses the redaction boundary exactly once (INV-AG-42)."
                        }
                      }
                    }
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "callId",
                  "result"
                ],
                "description": "The answer to one call. A transcript carrying a result for a call its suspension still names is a run that executed a held call; that is a relation between turns, refused by the store rather than by this file.",
                "properties": {
                  "kind": {
                    "const": "tool_result",
                    "description": "Discriminator for a tool-result turn."
                  },
                  "callId": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The call this answers. Exactly one turn answers a given callId."
                  },
                  "result": {
                    "description": "What the tool returned, after the redaction boundary projected it. Any JSON value: the shape belongs to the tool, not to this file."
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "callId",
                  "reason",
                  "ruleId"
                ],
                "description": "A refused call. It is an ordinary outcome the run continues from, not a failure: a refused call is not a failed job.",
                "properties": {
                  "kind": {
                    "const": "tool_refused",
                    "description": "Discriminator for a refusal turn."
                  },
                  "callId": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The call that was refused. A refusal answers a call exactly as a result does."
                  },
                  "reason": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Why it was refused, in the words the user is shown."
                  },
                  "ruleId": {
                    "type": "string",
                    "minLength": 1,
                    "description": "The rule that refused it, so the refusal can be traced to the declaration that caused it rather than to a model's choice."
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "kind",
                  "reason",
                  "replacedPosition"
                ],
                "description": "A turn removed by retention or by the user, replaced at the same position so the conversation does not silently change shape.",
                "properties": {
                  "kind": {
                    "const": "redacted",
                    "description": "Discriminator for a redaction marker."
                  },
                  "reason": {
                    "enum": [
                      "retention",
                      "user_deletion"
                    ],
                    "description": "Why the turn is gone: the retention floor expired it, or the user deleted it."
                  },
                  "replacedPosition": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "The position the removed turn occupied, which this marker now occupies, so positions stay dense."
                  }
                }
              }
            ]
          }
        }
      }
    },
    "suspension": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "reason",
        "callId",
        "requestId",
        "atPosition",
        "since"
      ],
      "description": "Where a run stopped. Present exactly while the run is suspended. Written durably, and the job moved to waiting, before the approval request reaches any surface - which is what makes an abrupt stop uninteresting. A transcript carrying a suspension whose call already has a result turn is a run that executed a held call; that is a relation between turns, so the store refuses it rather than this file.",
      "properties": {
        "reason": {
          "enum": [
            "awaiting_approval",
            "awaiting_answer"
          ],
          "description": "What the run is waiting for: a decision on a held call, or an answer to an open question."
        },
        "callId": {
          "type": "string",
          "minLength": 1,
          "description": "The ledger correlation identifier of the held call (INV-AG-05). At this point the ledger holds an intent for it and no result."
        },
        "requestId": {
          "type": "string",
          "minLength": 1,
          "description": "The approval request, or the open question, that satisfying this suspension answers."
        },
        "atPosition": {
          "type": "integer",
          "minimum": 1,
          "description": "The turn the run stops after. Both resume paths continue from here, which is what makes them one behaviour - VERIFIED (spikes/SP-6-pi-sdk/REPORT.md section 1 Q3)."
        },
        "since": {
          "type": "string",
          "minLength": 1,
          "description": "ISO-8601 instant the run suspended. Displayed; the suspension does not expire by itself."
        }
      }
    }
  },
  "$defs": {
    "ResumePlan": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "jobId",
        "callId",
        "disposition"
      ],
      "description": "How a suspension is satisfied. Not part of a transcript: it is the message that ends one, carried through the job manager and never by the window that showed the request. Applied once; applying one to a run that has already ended is RUN_ALREADY_FINISHED and changes nothing.",
      "properties": {
        "jobId": {
          "type": "string",
          "minLength": 1,
          "description": "The job whose suspended run this plan is applied to. A plan reaches a session only through its job."
        },
        "callId": {
          "type": "string",
          "minLength": 1,
          "description": "The held call the plan disposes of. It must be the call the suspension names."
        },
        "disposition": {
          "enum": [
            "approved",
            "denied",
            "answered",
            "expired",
            "cancelled"
          ],
          "description": "What the plan decides: execute the held call, refuse it and continue, supply an answer, let it be evaluated again from the beginning, or end the run executing nothing."
        },
        "answer": {
          "description": "The user's answer, present when disposition is answered. Any JSON value, and external content wherever it is read: an answer never satisfies a gate decision."
        }
      }
    }
  }
} as const;
