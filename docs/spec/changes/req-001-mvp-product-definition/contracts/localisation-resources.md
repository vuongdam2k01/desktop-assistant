---
contract: localisation-resources
version: 0.1.0
status: draft
owner: uix
consumers: [app, pet, agent]
schema_files: [localisation-resources.schema.json]
---

# Contract: Localisation Resources

## Purpose

Every interface string is resolved through this contract rather than written at the point of use, so that
Vietnamese and English are equal from the first release and a third language is a resource bundle rather than a
sweep through the codebase. It also draws the line the product needs between interface text, which is
translated, and agent-generated text, which is produced in the language of the conversation and is never
translated after the fact.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`localisation-resources.schema.json`](./localisation-resources.schema.json) | JSON Schema 2020-12 | normative |

The file is the shape of one language's bundle, including the key form: a dotted path naming the place a string
appears. What it cannot express is stated here instead. Resolution order — the selected language, then English,
then the key rendered visibly — is a property of the localiser rather than of a bundle. That a key still names
the right place after a rewording is a judgement made on review, because a bundle whose keys have drifted into
describing their own sentences satisfies the pattern and has still lost the property the contract exists for.
Whether every string reaching the interface passed through the localiser at all is likewise unobservable from a
bundle, and is judged against the running product.

## Schema / Surface

### 1. Interface & Data Types

```typescript
type LanguageTag = 'vi' | 'en' | string;   // extensible; the two shipped tags are not a closed set

type ResourceBundle = {
  language: LanguageTag;
  version: string;
  entries: Record<string, ResourceEntry>;  // key -> entry
};

type ResourceEntry = {
  message: string;                          // may contain {named} placeholders
  plural?: Record<'one' | 'other', string>;
  description?: string;                     // context for translators
};

interface Localiser {
  t(key: string, params?: Record<string, string | number>): string;
  language(): LanguageTag;
  setLanguage(tag: LanguageTag): void;      // takes effect without restart
  has(key: string): boolean;
}
```

## Semantics

A key is stable and describes where the string is used, not what it currently says, so that rewording is a
resource change and never a code change.

Resolution falls back in one direction only: the selected language, then English, then the key itself rendered
visibly. A missing translation therefore degrades to a readable English string rather than an empty label, and a
missing key is visible in the interface rather than silent — a blank control is harder to notice in review than
an obviously raw key.

The initial language follows the operating-system language and is overridable in settings. Changing it re-renders
the interface without restarting.

Agent-generated text is outside this contract. The pet replies in the language the user is writing in, which may
differ from the interface language; translating a model's output after the fact would change the persona's voice
and is not done. The consequence is that a persona specification must define voice in both supported languages,
which is an open product decision rather than a technical one.

Hard data inside an approval request — object names, before-and-after values, the triggering rule — is rendered
from the hook payload and is not passed through the localiser, because translating the description of a
dangerous operation is exactly the softening the approval card exists to prevent.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `missing_key` | The requested key exists in no bundle | Callee | The raw key is displayed, making the gap visible rather than blank |
| `missing_translation` | The key exists in English but not in the selected language | Callee | The English string is shown |
| `bad_placeholder` | A parameter named in the message was not supplied | Caller | The placeholder is rendered literally and the occurrence is logged locally |
| `bundle_unreadable` | A resource bundle is malformed | Callee | The product falls back to the English bundle and reports the failure once |

## Compatibility

MAJOR: removing or repurposing a key, which silently changes what an existing interface element says.

MINOR: adding a key, adding a language, adding a plural form.

PATCH: changing a message's wording within the same meaning.

Support window: a bundle declares the resource version it was authored against; a bundle from an older minor
version resolves, with the keys added since falling back to English.

## Examples

Valid — an entry with a named placeholder and translator context:

```json
{
  "language": "vi",
  "version": "1.0.0",
  "entries": {
    "jobs.detail.undo.disabled": {
      "message": "Không thể hoàn tác: mọi thao tác trong job này đều không đảo ngược được.",
      "description": "Shown on the job detail page when every operation is irreversible."
    },
    "jobs.list.running": {
      "message": "{count} việc đang chạy",
      "plural": { "one": "{count} việc đang chạy", "other": "{count} việc đang chạy" }
    }
  }
}
```

Rejected — a key that encodes its current wording:

```json
{
  "entries": {
    "cannot_undo_because_everything_is_irreversible": { "message": "…" }
  }
}
```

Refused: the key names the sentence rather than the place. Rewording then forces a code change, which is the
coupling this contract exists to remove.
