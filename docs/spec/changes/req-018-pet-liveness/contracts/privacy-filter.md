---
contract: privacy-filter
version: 1.0.0
status: draft
owner: platform
consumers: [pet, app]
schema_files: [privacy-filter.schema.json]
---

# Contract: privacy-filter

## Purpose
Defines the privacy boundary contract for desktop screen context, ensuring only anonymized application category classifications and window geometric bounding boxes are exposed to the application runtime, while strictly barring raw window titles from being captured, persisted, or transmitted.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`privacy-filter.schema.json`](./privacy-filter.schema.json) | JSON Schema 2020-12 | normative |

The file is the whole of what the native filter may hand to the runtime, and it is closed: a payload carrying a
window title is refused by the file rather than detected afterwards, which is what turns the privacy rule from
a review obligation into a shape. What it cannot express is the part that happens before the payload exists —
that the raw title is read, matched against the category patterns and cleared inside native memory, so that no
string a person wrote ever becomes a runtime value. That is judged by inspecting what leaves the native module,
not by validating a document. The same is true of the rule's consequence downstream: that no title reaches the
local store, the ledger or a model provider is a property of the running product, and it is where INV-LIVE-01
is actually verified.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of what crosses the boundary is
[`privacy-filter.schema.json`](./privacy-filter.schema.json). The declarations below name the same members for
a reader and add the service interface, which carries no payload of its own.

```typescript
export type ApplicationCategory =
  | 'EDITOR'
  | 'BROWSER'
  | 'TERMINAL'
  | 'DOCUMENT'
  | 'COMMUNICATION'
  | 'MEDIA'
  | 'SYSTEM'
  | 'OTHER';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaretCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SanitizedWindowContext {
  processName: string; // e.g. "code.exe", "notepad.exe"
  category: ApplicationCategory;
  bounds: WindowBounds;
  isFullscreen: boolean;
}

export interface ScreenContextEvent {
  timestamp: number;
  displayId: number;
  foregroundWindow: SanitizedWindowContext;
  caret?: CaretCoordinate;
}

export interface NativePrivacyFilterService {
  /** Starts native foreground and caret monitoring hook */
  startMonitoring(callback: (event: ScreenContextEvent) => void): void;

  /** Stops monitoring and releases native hooks */
  stopMonitoring(): void;

  /** Queries current caret coordinate */
  getCurrentCaret(): CaretCoordinate | null;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `screenContext:update` | Native -> Main | Event Callback | `void` | `ScreenContextEvent` | Native hook errors caught silently |
| `screenContext:getCaret` | Main -> Native | Synchronous Query | `void` | `CaretCoordinate \| null` | Returns null if no active caret |

### 3. Module Descriptor / Manifest Specification
The module carries no manifest. The only descriptor on this boundary is the event payload,
[`privacy-filter.schema.json`](./privacy-filter.schema.json), declared above.

## Semantics
- `SanitizedWindowContext`: Strips all text titles, document names, and URLs. Only exposes `processName` (e.g. `notepad.exe`), assigned `category`, and geometric `bounds`.
- `ScreenContextEvent`: Emitted upon foreground window changes or focus switches. Raw title text is never populated in this event or retained in memory.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `HOOK_INSTALL_FAILED` | Win32 `SetWinEventHook` failed to register | Native Module | Logs warning; pet disables autonomous evasion |
| `CARET_UNAVAILABLE` | Foreground application does not expose Win32 caret | Native Module | Returns null; pet maintains stationary safety margin |

## Compatibility
- MAJOR: Renaming `ApplicationCategory` enum members or adding required fields containing personal text.
- MINOR: Adding new application categories or optional non-sensitive geometric flags.
- PATCH: Updating internal regex rules mapping process names to categories.

## Examples

### Valid Example: Sanitized Screen Context Event
```json
{
  "timestamp": 1726178400000,
  "displayId": 0,
  "foregroundWindow": {
    "processName": "notepad.exe",
    "category": "EDITOR",
    "bounds": {
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600
    },
    "isFullscreen": false
  },
  "caret": {
    "x": 494,
    "y": 251,
    "width": 1,
    "height": 25
  }
}
```
*Note*: No window title field exists. Document title ("confidential_contract.txt") is completely excluded.

### Rejected Example: Payload Containing Raw Window Title
```json
{
  "foregroundWindow": {
    "processName": "notepad.exe",
    "windowTitle": "confidential_contract.txt - Notepad"
  }
}
```
*Rationale*: Inclusion of `windowTitle` violates the Zero-Persistent Title privacy rule (`INV-LIVE-01`); rejected by contract schema.
