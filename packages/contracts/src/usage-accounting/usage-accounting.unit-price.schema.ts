/**
 * Normative shape of a unit price as the user enters it and as it replicates, for agent/contracts/usage-accounting@0.1.0, and what the price form validates against before it saves. Prices are per million tokens because that is how providers quote them: entering a per-token price would ask the user to type seven leading zeros and would make a typo indistinguishable from a correct value, and the stored form should match what the user reads on their pricing page. Both prices are required rather than one being inferred from the other - most providers charge more for output than for input, so inferring a missing output price would understate every job by a predictable margin.
 */
export interface UnitPrice {
  profileId: string;
  /**
   * A model the profile offers. A price naming a model it does not offer is refused at save (MODEL_NOT_OFFERED), naming the models that are available.
   */
  model: string;
  /**
   * Decimal text with no currency symbol and no unit. Anything else is PRICE_MALFORMED, refused at save with the accepted form stated.
   */
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  /**
   * An ISO 4217 code, as the user entered it with the price. Currency belongs to the entry rather than to a global setting, which is why a job whose records carry two currencies has per-role figures and no single total: adding them would need an exchange rate the product has no business inventing.
   */
  currency: string;
  enteredAt: string;
}


export const USAGE_ACCOUNTING_UNIT_PRICE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/agent/usage-accounting/unit-price/0.1.0.json",
  "title": "UnitPrice",
  "description": "Normative shape of a unit price as the user enters it and as it replicates, for agent/contracts/usage-accounting@0.1.0, and what the price form validates against before it saves. Prices are per million tokens because that is how providers quote them: entering a per-token price would ask the user to type seven leading zeros and would make a typo indistinguishable from a correct value, and the stored form should match what the user reads on their pricing page. Both prices are required rather than one being inferred from the other - most providers charge more for output than for input, so inferring a missing output price would understate every job by a predictable margin.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "profileId",
    "model",
    "inputPricePerMillion",
    "outputPricePerMillion",
    "currency",
    "enteredAt"
  ],
  "properties": {
    "profileId": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]{1,62}$"
    },
    "model": {
      "type": "string",
      "minLength": 1,
      "description": "A model the profile offers. A price naming a model it does not offer is refused at save (MODEL_NOT_OFFERED), naming the models that are available."
    },
    "inputPricePerMillion": {
      "type": "string",
      "pattern": "^\\d+(\\.\\d{1,6})?$",
      "description": "Decimal text with no currency symbol and no unit. Anything else is PRICE_MALFORMED, refused at save with the accepted form stated."
    },
    "outputPricePerMillion": {
      "type": "string",
      "pattern": "^\\d+(\\.\\d{1,6})?$"
    },
    "currency": {
      "type": "string",
      "pattern": "^[A-Z]{3}$",
      "description": "An ISO 4217 code, as the user entered it with the price. Currency belongs to the entry rather than to a global setting, which is why a job whose records carry two currencies has per-role figures and no single total: adding them would need an exchange rate the product has no business inventing."
    },
    "enteredAt": {
      "type": "string",
      "minLength": 1
    }
  }
} as const;
