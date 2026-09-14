---
contract: secure-storage
version: 0.1.0
status: draft
owner: platform
consumers: [platform, connector, agent, sync, app, uix]
schema_files: [secure-storage.sql]
---

# Contract: Secure Storage

## Purpose

This is the only way to reach the device's credentials. It exposes writing a credential under its key, reading
one back inside the process that will use it, asking what is present without decrypting anything, and the two
erasures — the scoped one a disconnect performs and the whole-store one that sign-out, revocation, account
deletion and uninstall perform. It exists so that no part of the product encrypts, decrypts or stores a
credential itself, and so that the guarantee everything else rests on — that a credential value never crosses the
process boundary and never appears in plain text on disk — has a single place where it is either kept or
refused.

Which keys may be written, what erases them and how an unreadable one is replaced is not decided here: it is
declared per class in `platform/contracts/credential-class-descriptor@0.1.0`, which this contract reads.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`secure-storage.sql`](./secure-storage.sql) | SQL DDL | normative |

`secure-storage.sql` is the physical shape of the store this contract opens. It is worth reading for what it
does not contain: no column anywhere in it holds a credential in plain text, so the guarantee that a value
exists decrypted only inside the process using it is a property of the schema rather than a discipline in the
code above it. It also carries the naming rule that makes a scoped erasure complete, the unreadable mark of
INV-PLT-07, and the single in-flight erasure of INV-PLT-08.

The registered class set is deliberately not a relation there: a class is registered in-process from
`platform/contracts/credential-class-descriptor@0.1.0`, and an entry derives its class from its key.

## Schema / Surface

### 1. Interface & Data Types

```typescript
import type { CredentialClassDescriptor, ClassId } from "credential-class-descriptor@0.1.0";

// "<domain>:<category>:<identity>" with an optional ":<field>".
// Example: "connector:notion:default:token". Prefixes name groups: "connector:notion:" is one connector.
type CredentialKey = string;

type ErasureTrigger =
  | "connector_disconnect"   // scoped to a key prefix
  | "sign_out"
  | "device_revocation"
  | "account_deletion"
  | "uninstall";

interface CredentialPresence {
  key: CredentialKey;
  classId: ClassId;
  updatedAt: string;          // ISO-8601; when the entry was last written
  readable: boolean;          // false once a read has failed to decrypt it
  metadata: Record<string, string>;  // only fields the class declares; never a secret
}

interface ErasureOutcome {
  trigger: ErasureTrigger;
  scope: CredentialKey | "*";  // a key prefix, or the whole store
  entriesErased: number;
  completed: boolean;          // false only when the process stopped mid-run; see Semantics
}

interface ErasureState {
  trigger: ErasureTrigger;
  scope: CredentialKey | "*";
  startedAt: string;
}

interface SecureCredentialStore {
  // Availability. Asked before the first write, and whenever a write has failed.
  isAvailable(): Promise<boolean>;

  // Writing and reading. Available only inside the process that makes the calls these credentials authorise.
  put(key: CredentialKey, value: string, metadata?: Record<string, string>): Promise<void>;
  get(key: CredentialKey): Promise<string>;   // resolves with the value, or rejects; never resolves empty

  // Presence. Decrypts nothing, so it is the surface a window process reads through.
  presence(prefix: CredentialKey | "*"): Promise<CredentialPresence[]>;

  // Erasure. Scoped erasure for a disconnect; whole-store erasure for everything else.
  erase(prefix: CredentialKey, trigger: ErasureTrigger): Promise<ErasureOutcome>;
  eraseAll(trigger: ErasureTrigger): Promise<ErasureOutcome>;
  pendingErasure(): Promise<ErasureState | null>;   // read at start, before any other use

  // Class registration. Performed once per class at introduction; the registered set bounds every key above.
  registerClass(descriptor: CredentialClassDescriptor): void;
}
```

The relations these methods read and write are [`secure-storage.sql`](./secure-storage.sql).

There is deliberately no `list`, no `export` and no `getAll`. The surface does not express obtaining more than
one value at a time, and `presence` — the only bulk operation — returns no values at all. There is also no
`setReadable` and no repair operation: an entry that failed to decrypt is replaced through `put` under its
class's restoration route, never mended in place.

### 2. Wire / Communication Protocol

The store is opened by exactly one process — the one that also makes tool calls — and the window processes reach
it across the boundary below. Every channel that exists returns presence or state; none returns a value. That is
the whole of the boundary control, and it is structural rather than a permission check, so there is nothing for a
compromised or defective window process to ask for.

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `credentials.presence` | Window → Store | Request-Response | `{ prefix }` | `CredentialPresence[]` | `SECURE_STORAGE_UNAVAILABLE` |
| `credentials.available` | Window → Store | Request-Response | — | `{ available: boolean }` | none — the answer is the state |
| `credentials.changed` | Store → Window | Stream | — | `CredentialPresence` as entries are written, replaced or erased | Stream loss is not an error: the window re-reads through `credentials.presence` |
| `credentials.unreadable` | Store → Window | Stream | — | `{ key, classId, restorationRoute }` | Consumed to show which connections are unavailable on this device and that they are being restored |
| `credentials.erasureState` | Window → Store | Request-Response | — | `ErasureState \| null` | `SECURE_STORAGE_UNAVAILABLE` |
| *(get)* | — | — | — | — | Not exposed. Reading a value is in-process only, beside the call it authorises |
| *(put)* | — | — | — | — | Not exposed. A credential arrives from an authorisation flow or from replication, both of which run in the store's own process |

### 3. Module Descriptor / Manifest Specification

Specified separately in `platform/contracts/credential-class-descriptor@0.1.0`. This contract consumes it
through `registerClass` and applies what it declares; it defines no descriptor of its own.

## Semantics

- **`put` returns only when the ciphertext is durable.** A caller that has awaited it may report the connector
  connected; a caller that received an error must not, and must leave the connector disconnected with nothing
  written. The direction of failure is the same as the ledger's: the cost of failing is a connector that did not
  connect, never a token the product believes it has.
- **`put` encrypts through the operating system's facility and stores nothing else.** The product holds no key.
  On Windows this is the platform facility measured in `spikes/SP-11-secure-storage/REPORT.md` §1 Q1, which
  protects a randomly generated key with the operating-system user profile and encrypts with an authenticated
  cipher; the ciphertext carries a fixed 31-byte overhead at every size — §1 Q2.
- **`get` either yields the value or rejects.** It never resolves with an empty string, a placeholder or a stale
  cached value. The three failing cases are distinct and a caller must treat them differently:
  `CREDENTIAL_NOT_FOUND` means the user has not connected, `CREDENTIAL_UNREADABLE` means the entry exists and
  must be replaced through its class's restoration route, and `SECURE_STORAGE_UNAVAILABLE` means nothing can be
  read or written at all on this device right now.
- **An unreadable entry is marked on the failed read and not by a scan.** Nothing sweeps the store looking for
  damage, because the response to finding it is what the failed read already performs. The mark makes `presence`
  report `readable: false` and raises `credentials.unreadable`, so a surface can say which connections are
  unavailable on this device without any caller having attempted a read.
- **`presence` decrypts nothing.** It reads the key, the class, the last-updated time, the readable state and
  the metadata fields the class declares. Metadata is bounded by the class exactly so that this path cannot
  become a way to read a secret without decrypting one.
- **Every key is matched against a registered class before it is written.** A key matching no registered class,
  or matching two, is refused. There is no default class, because a default would have to choose an erasure
  policy for a credential nobody classified.
- **`erase` is scoped by key prefix; `eraseAll` covers the store.** Both overwrite what they remove before
  discarding it, and both are idempotent: running either again over the same scope reaches the same state and
  succeeds on an empty scope. An erasure that is interrupted records its state, and `pendingErasure` is read at
  the next start before any other use of the store, so the run finishes before a credential could be used.
- **`eraseAll` completes before the store file is removed.** Uninstall and account deletion remove the file only
  after the erasure reports completion, which is what makes a half-removed installation leave nothing readable —
  `spikes/SP-11-secure-storage/REPORT.md` §1 Q6.
- **`isAvailable` is asked, not assumed.** When it answers false the product reports that credentials cannot be
  stored and holds nothing; there is no plain-text fallback path in this contract, and adding one would be a
  major version and a constitutional question rather than a convenience.

## Error Matrix

| Error Code | Cause | Handling Party (Caller / Callee / Both) | User-Visible Behavior |
| --- | --- | --- | --- |
| `SECURE_STORAGE_UNAVAILABLE` | The operating system's secure-storage facility cannot be reached | Both | The product states that credentials cannot be stored on this device, refuses to connect anything new, and holds nothing in plain text |
| `CREDENTIAL_NOT_FOUND` | No entry exists under the key | Caller | The connector or provider is presented as not connected, with its ordinary connect action |
| `CREDENTIAL_UNREADABLE` | The entry exists but cannot be decrypted — altered bytes, a foreign scheme marker, a truncated buffer, or a profile that can no longer decrypt what it wrote | Caller | The connection is shown as unavailable on this device and being restored; it is not shown as revoked at the platform, and the user is not asked to re-authorise |
| `KEY_MALFORMED` | The key does not carry a domain, a category and an identity | Caller, as a defect | None: nothing is written, and the defect is visible in development rather than at the next sign-out |
| `KEY_UNCLASSIFIED` | The key matches no registered Credential Class | Caller, as a defect | None; same reasoning |
| `CLASS_PATTERN_CONFLICT` | A descriptor being registered claims a key pattern that overlaps a registered one | Callee | The product fails to start rather than storing credentials whose erasure policy is ambiguous |
| `METADATA_NOT_DECLARED` | A metadata field is offered that the class does not declare | Caller, as a defect | Nothing is written; this is the check that keeps a secret out of the undecrypted path |
| `WRITE_FAILED` | The ciphertext could not be made durable — disk full, store locked, store damaged | Caller | The connector is left disconnected with the reason stated; nothing partial is retained |
| `ERASURE_INCOMPLETE` | The process stopped part-way through an erasure | Callee | Nothing is visible to the user at the time; the next start completes the erasure before the product is usable |

## Compatibility

- **MAJOR** — removing a method, adding a required parameter, exposing a channel that returns a credential
  value, or introducing any storage path that does not pass through the operating system's facility. The last two
  are major not because a caller breaks but because a guarantee this contract exists to make disappears.
- **MINOR** — adding a method, an optional parameter, a channel that returns presence or state, an erasure
  trigger, or an error code a caller can treat as it treats the nearest existing one.
- **PATCH** — wording, and error messages that do not change a code.
- Version discovery is by the contract version recorded in this file. The store's own file shape version is
  separate and is not tied to it, exactly as `ledger/contracts/ledger-store@0.1.0` separates the two.

## Examples

A valid sequence around one connector's authorisation — the order is the contract, not an implementation detail:

```typescript
await store.put(
  "connector:notion:default:token",
  JSON.stringify({ accessToken, refreshToken, expiresAt, scopes, workspace }),
  { workspaceName: "Personal", scopeProfile: "read-write" }   // declared by the class; not secret
);
// only now is the connector reported connected
const raw = await store.get("connector:notion:default:token");  // in the calling process only
```

A rejected use, and why:

```typescript
// In a window process, rendering the connectors screen:
const token = await ipc.invoke("credentials.get", "connector:notion:default:token");
```

There is no `credentials.get` channel to invoke, so this fails at the boundary rather than at a permission check.
The window needs the connector's state, not its token, and `credentials.presence` answers that without
decrypting anything. The distinction matters because the window process renders untrusted content — connector
bodies, model output, user input — and a channel that could return a token would make every one of those a route
to it.

A second rejected use:

```typescript
await store.put("notion_token", accessToken);   // no domain, no identity
```

Refused with `KEY_MALFORMED`. The key names no group, so disconnecting the Notion connector would erase by the
prefix `connector:notion:` and leave this entry behind — a live token on a device the user believes they have
disconnected. That is the failure the naming rule exists to prevent, which is why the refusal is at write time
rather than a lint.

## Migration

Not applicable at 0.1.0 — this is the first version and has no consumers on an earlier one.
