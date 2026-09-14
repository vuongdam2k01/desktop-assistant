/**
 * Normative shape of what is assembled and injected into a worker agent's system prompt before its first turn, for agent/contracts/worker-loop@0.2.0. Every value here is a fact the agent may not derive for itself: the moment it is running at, the tools that exist, and the ceiling it works under. What the file cannot carry is the wording of the four directives - clarification discipline, multimodal source precedence, self-verification, temporal anchoring - which are normative prose and live in the contract document. At 0.2.0 the file admits two optional members carrying the account of how this context was built - the skills loaded into it and the budget the job was given - produced by agent/contracts/context-assembly@1.0.0. Both are optional and both are facts rather than obligations: a context written against 0.1.0 validates here unchanged, and a build that ignores them assembles the prompt it always assembled.
 */
export interface WorkerSystemPromptContext {
  /**
   * The role this context is built for. It is stated rather than implied so that a context assembled for another role - the risk judge, the rule elicitor - cannot be handed to the worker loop by accident.
   */
  role: "worker";
  /**
   * The single instant every relative date resolves against (INV-AG-26). All four members are required together: a date without a day name and a zone is what produced the boundary-day errors case S-16 records in spikes/SP-4-agent-loop/REPORT.md section 1 Q1.
   */
  temporalAnchor: {
    /**
     * Calendar date in the user's own zone, YYYY-MM-DD.
     */
    currentDate: string;
    /**
     * The day's name, rendered in the language the agent is addressed in. Deliberately not an enumeration: the measured harness anchored in Vietnamese, and constraining this to English names would make a correct anchor unrepresentable.
     */
    currentDayOfWeek: string;
    /**
     * Local time of day, HH:mm:ss, in the zone named below.
     */
    currentTime: string;
    /**
     * IANA zone identifier, e.g. Asia/Ho_Chi_Minh. Named rather than offset, so that a rule about a working day means the same thing across a daylight-saving boundary.
     */
    timezone: string;
  };
  /**
   * Names of the tools this session holds, as the wrapping factory produced them. A session with no tools at all is refused here rather than started: an agent that can reason and cannot act reports completion it never performed.
   *
   * @minItems 1
   */
  registeredTools: [string, ...string[]];
  /**
   * The reasoning-turn ceiling for this job. The upper bound is in the file rather than in the loop's code, so that a context configured above the ceiling is refused at assembly rather than allowed to run away and be truncated later (MAX_TURNS_EXCEEDED). Raising it is MAJOR and is unchanged at 0.2.0.
   */
  maxTurns: number;
  /**
   * Optional since 0.2.0. The skills whose bodies are in this context, projected from the skillsLoaded member of the assembled-context account that agent/contracts/context-assembly@1.0.0 records per request. Only the two members an agent can reason about are carried; the fuller account - origin, the request the body first entered at, what it cost - stays in the record, because the agent has nothing to do with it. An empty array is meaningful and different from an absent member: it says the account exists and no skill was loaded.
   *
   * Items: One loaded skill, as the agent is told about it.
   */
  loadedSkills?: {
    /**
     * The skill identifier as the catalogue resolved it. Exactly one package answers to it: two packages declaring one identifier never merge (INV-AG-35).
     */
    skillId: string;
    /**
     * Why this body is here: the role's entry preloads it; the job's work matched its applicability text before the first turn; or the work turned out to match it later, in which case the budget was re-evaluated before this request. The vocabulary is owned by agent/contracts/context-assembly@1.0.0 and repeated here rather than referenced across files, so this file can be read on its own.
     */
    reason: "preloaded-by-role" | "matched-at-start" | "matched-mid-job";
  }[];
  /**
   * Optional since 0.2.0. The budget this job was given, in the shape agent/contracts/context-assembly@1.0.0 records it, carried unchanged rather than restated in other words. It is a fact the agent is told, not a control: nothing the model writes changes it, and the reduction ladder runs on the composer's decision whether or not the agent was told. Its absence means no account was injected, never that the job has no budget - every job holds one. The reserve fraction that produces these figures from a model window is UNVERIFIED and is not pinned by this file; design.md R1 proposes spike SP-23 to measure it.
   */
  contextBudget?: {
    /**
     * Every figure here is a token count, taken by the composer before the request is sent. The provider's own count is authoritative and may differ, which is one reason a reserve exists rather than the ceiling being the window itself.
     */
    unit: "tokens";
    /**
     * How the ceiling was arrived at. 'model-window' means it was derived from the context window the assigned model's provider profile declares, and modelWindowTokens records that window. 'declared-fallback' means the profile declared no window and the product used its declared fallback budget, recorded AS a fallback rather than dressed up as a derived figure.
     */
    derivation: "model-window" | "declared-fallback";
    /**
     * The context window the assigned model's provider profile declares. Required when derivation is 'model-window' and forbidden otherwise, so a fallback can never be read as though a window had been consulted.
     */
    modelWindowTokens?: number;
    /**
     * The whole of what this job may spend on one request. A job whose assembled context already exceeds it does not start.
     */
    ceilingTokens: number;
    /**
     * Headroom held back inside the ceiling for the turn that follows. Reduction begins when the assembled context plus the expected next turn crosses it.
     */
    reserveTokens: number;
  };
}


export const WORKER_LOOP_PROMPT_CONTEXT_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/worker-loop/prompt-context/0.2.0.json",
  "title": "WorkerSystemPromptContext",
  "description": "Normative shape of what is assembled and injected into a worker agent's system prompt before its first turn, for agent/contracts/worker-loop@0.2.0. Every value here is a fact the agent may not derive for itself: the moment it is running at, the tools that exist, and the ceiling it works under. What the file cannot carry is the wording of the four directives - clarification discipline, multimodal source precedence, self-verification, temporal anchoring - which are normative prose and live in the contract document. At 0.2.0 the file admits two optional members carrying the account of how this context was built - the skills loaded into it and the budget the job was given - produced by agent/contracts/context-assembly@1.0.0. Both are optional and both are facts rather than obligations: a context written against 0.1.0 validates here unchanged, and a build that ignores them assembles the prompt it always assembled.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "role",
    "temporalAnchor",
    "registeredTools",
    "maxTurns"
  ],
  "properties": {
    "role": {
      "const": "worker",
      "description": "The role this context is built for. It is stated rather than implied so that a context assembled for another role - the risk judge, the rule elicitor - cannot be handed to the worker loop by accident."
    },
    "temporalAnchor": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "currentDate",
        "currentDayOfWeek",
        "currentTime",
        "timezone"
      ],
      "description": "The single instant every relative date resolves against (INV-AG-26). All four members are required together: a date without a day name and a zone is what produced the boundary-day errors case S-16 records in spikes/SP-4-agent-loop/REPORT.md section 1 Q1.",
      "properties": {
        "currentDate": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
          "description": "Calendar date in the user's own zone, YYYY-MM-DD."
        },
        "currentDayOfWeek": {
          "type": "string",
          "minLength": 1,
          "description": "The day's name, rendered in the language the agent is addressed in. Deliberately not an enumeration: the measured harness anchored in Vietnamese, and constraining this to English names would make a correct anchor unrepresentable."
        },
        "currentTime": {
          "type": "string",
          "pattern": "^([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d$",
          "description": "Local time of day, HH:mm:ss, in the zone named below."
        },
        "timezone": {
          "type": "string",
          "pattern": "^(?:UTC|[A-Za-z_]+/[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)?)$",
          "description": "IANA zone identifier, e.g. Asia/Ho_Chi_Minh. Named rather than offset, so that a rule about a working day means the same thing across a daylight-saving boundary."
        }
      }
    },
    "registeredTools": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "description": "Names of the tools this session holds, as the wrapping factory produced them. A session with no tools at all is refused here rather than started: an agent that can reason and cannot act reports completion it never performed.",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "maxTurns": {
      "type": "integer",
      "minimum": 1,
      "maximum": 15,
      "description": "The reasoning-turn ceiling for this job. The upper bound is in the file rather than in the loop's code, so that a context configured above the ceiling is refused at assembly rather than allowed to run away and be truncated later (MAX_TURNS_EXCEEDED). Raising it is MAJOR and is unchanged at 0.2.0."
    },
    "loadedSkills": {
      "type": "array",
      "uniqueItems": true,
      "description": "Optional since 0.2.0. The skills whose bodies are in this context, projected from the skillsLoaded member of the assembled-context account that agent/contracts/context-assembly@1.0.0 records per request. Only the two members an agent can reason about are carried; the fuller account - origin, the request the body first entered at, what it cost - stays in the record, because the agent has nothing to do with it. An empty array is meaningful and different from an absent member: it says the account exists and no skill was loaded.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "skillId",
          "reason"
        ],
        "description": "One loaded skill, as the agent is told about it.",
        "properties": {
          "skillId": {
            "type": "string",
            "minLength": 1,
            "description": "The skill identifier as the catalogue resolved it. Exactly one package answers to it: two packages declaring one identifier never merge (INV-AG-35)."
          },
          "reason": {
            "enum": [
              "preloaded-by-role",
              "matched-at-start",
              "matched-mid-job"
            ],
            "description": "Why this body is here: the role's entry preloads it; the job's work matched its applicability text before the first turn; or the work turned out to match it later, in which case the budget was re-evaluated before this request. The vocabulary is owned by agent/contracts/context-assembly@1.0.0 and repeated here rather than referenced across files, so this file can be read on its own."
          }
        }
      }
    },
    "contextBudget": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "unit",
        "derivation",
        "ceilingTokens",
        "reserveTokens"
      ],
      "description": "Optional since 0.2.0. The budget this job was given, in the shape agent/contracts/context-assembly@1.0.0 records it, carried unchanged rather than restated in other words. It is a fact the agent is told, not a control: nothing the model writes changes it, and the reduction ladder runs on the composer's decision whether or not the agent was told. Its absence means no account was injected, never that the job has no budget - every job holds one. The reserve fraction that produces these figures from a model window is UNVERIFIED and is not pinned by this file; design.md R1 proposes spike SP-23 to measure it.",
      "properties": {
        "unit": {
          "const": "tokens",
          "description": "Every figure here is a token count, taken by the composer before the request is sent. The provider's own count is authoritative and may differ, which is one reason a reserve exists rather than the ceiling being the window itself."
        },
        "derivation": {
          "enum": [
            "model-window",
            "declared-fallback"
          ],
          "description": "How the ceiling was arrived at. 'model-window' means it was derived from the context window the assigned model's provider profile declares, and modelWindowTokens records that window. 'declared-fallback' means the profile declared no window and the product used its declared fallback budget, recorded AS a fallback rather than dressed up as a derived figure."
        },
        "modelWindowTokens": {
          "type": "integer",
          "minimum": 1,
          "description": "The context window the assigned model's provider profile declares. Required when derivation is 'model-window' and forbidden otherwise, so a fallback can never be read as though a window had been consulted."
        },
        "ceilingTokens": {
          "type": "integer",
          "minimum": 1,
          "description": "The whole of what this job may spend on one request. A job whose assembled context already exceeds it does not start."
        },
        "reserveTokens": {
          "type": "integer",
          "minimum": 0,
          "description": "Headroom held back inside the ceiling for the turn that follows. Reduction begins when the assembled context plus the expected next turn crosses it."
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
    }
  }
} as const;
