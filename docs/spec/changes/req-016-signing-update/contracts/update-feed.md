---
contract: update-feed
version: 1.0.0
status: draft
owner: backend
consumers: [platform, app]
schema_files: [update-feed.openapi.yaml, update-feed.schema.json]
---

# Contract: update-feed

## Purpose
Defines the HTTP feed interface between the backend static artifact server and the client-side `electron-updater` for publishing and consuming desktop application releases, update manifests, and binary installers.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`update-feed.openapi.yaml`](./update-feed.openapi.yaml) | OpenAPI 3.1 | normative — the two reads, their status codes and range support |
| [`update-feed.schema.json`](./update-feed.schema.json) | JSON Schema 2020-12 | normative — the manifest document, served as YAML |

The two files hold the surface and the document. What neither can express is the only thing that makes an
unauthenticated feed safe to read, and it is stated here instead: the digest in the manifest is checked against
the downloaded bytes, and the downloaded executable is checked against the trusted roots on the device, before
anything is installed. A manifest both files accept is therefore still refused after download when either check
fails — measured as a complete rejection with `CERT_E_UNTRUSTEDROOT` and the payload deleted from disk, VERIFIED
(`spikes/SP-16-signing-update/REPORT.md#1-tra-loi-tung-cau-hoi` Q7). Nor can either file say when an update is
installed: that it waits for the user and never interrupts a running job belongs to the client and is specified
in `specs/app/spec.md`.

## Schema / Surface

### 1. Interface & Data Types

The normative shape of the manifest is [`update-feed.schema.json`](./update-feed.schema.json) and the
normative wire surface is [`update-feed.openapi.yaml`](./update-feed.openapi.yaml). The declarations below name
the same members for a reader and add the client-side check result, which crosses no wire at all.

```typescript
export interface UpdateFileEntry {
  url: string;
  sha512: string;
  size: number;
  blockMapSize?: number;
}

export interface UpdateManifestYaml {
  version: string;
  files: UpdateFileEntry[];
  path: string;
  sha512: string;
  releaseDate: string; // ISO-8601 UTC
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  versionInfo?: UpdateManifestYaml;
}
```

### 2. Wire / Communication Protocol

| Channel / Endpoint / Topic | Direction | Interaction Pattern | Input / Payload Schema | Return / Event Schema | Error Codes & Handling |
| --- | --- | --- | --- | --- | --- |
| `GET /updates/latest.yml` | Client -> Backend | HTTP Request-Response | `void` (Header: `User-Agent`) | Content-Type `text/yaml`: `UpdateManifestYaml` | `404 Not Found`, `500 Server Error` |
| `GET /updates/:filename` | Client -> Backend | HTTP Stream / Range | Optional Header: `Range: bytes=start-end` | Binary executable stream or `206 Partial Content` | `404 Not Found`, `416 Range Not Satisfiable` |

### 3. Module Descriptor / Manifest Specification
The normative manifest shape is [`update-feed.schema.json`](./update-feed.schema.json) and is not restated
here. The document below is one manifest as the packaging tool emits it, shown so a reader can see the shape in
the form it actually arrives in; its digests are abbreviated for reading and are not well-formed values.
```yaml
version: 1.0.1
files:
  - url: DesktopAssistant Setup 1.0.1.exe
    sha512: OId1ZlMhW1mSjM5g1xO9aVwA3...==
    size: 111622936
path: DesktopAssistant Setup 1.0.1.exe
sha512: OId1ZlMhW1mSjM5g1xO9aVwA3...==
releaseDate: '2026-09-12T03:39:28.410Z'
```

## Semantics
- `latest.yml`: Static unauthenticated YAML file published alongside releases. Does not require server-side cryptographic signatures because integrity is validated via client SHA-512 checks and executable Authenticode verification.
- HTTP Range Support: Server MUST support `Range: bytes=` headers to permit differential chunk downloads via blockmaps.

## Error Matrix

| Error Code | Cause | Handling Party | User-Visible Behavior |
| --- | --- | --- | --- |
| `404 Not Found` | Update manifest or binary missing from server | Client (Updater) | Silently logs "No update available" |
| `HASH_MISMATCH` | Downloaded file SHA-512 does not match manifest | Client (Updater) | Deletes cached file; notifies update failed |
| `CERT_UNTRUSTED` | Authenticode signature check `WinVerifyTrust` fails | Client (Updater) | Rejects installation; displays security error |

## Compatibility
- MAJOR: Renaming manifest filename or restructuring required YAML properties.
- MINOR: Adding optional metadata fields (e.g. `releaseNotes`, `stagingPercentage`).
- PATCH: Changing CDN or hosting bucket origins while preserving the generic feed contract.

## Examples

### Valid Example: Update Manifest Response
```yaml
version: 1.0.1
files:
  - url: DesktopAssistant Setup 1.0.1.exe
    sha512: abc123def456...==
    size: 111622936
path: DesktopAssistant Setup 1.0.1.exe
sha512: abc123def456...==
releaseDate: '2026-09-12T12:00:00.000Z'
```

### Rejected Example: Manifest Without Checksum
```yaml
version: 1.0.1
path: DesktopAssistant.exe
```
*Rationale*: Manifest lacks required `sha512` field; updater rejects manifest as malformed. The digests in both
documents above are abbreviated so they can be read; a published manifest carries the full base64 value the
schema file requires.
