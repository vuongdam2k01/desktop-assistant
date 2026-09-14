---
contract: update-feed
version: 1.1.0
status: draft
owner: backend
consumers: [platform, app]
schema_files: [update-feed.openapi.yaml, update-feed.schema.json]
---

# Contract: update-feed

## Purpose

Defines the static HTTP feed between the release artifact server and the desktop client's updater. Version
1.1.0 widens the feed's key from the release alone to the release, the operating system and the processor
architecture, because a macOS client cannot install a Windows package and an Apple Silicon client is offered
nothing useful by an Intel one.

## Amends

Supersedes `update-feed@1.0.0`, authored in `req-016-signing-update` from the Windows measurement. The change
is additive and therefore MINOR: a client written against 1.0.0 keeps reading `latest.yml` and keeps receiving
the Windows feed, which is the only thing that name ever meant. Nothing in 1.0.0 is removed or reinterpreted.

## Machine-Readable Artifacts

| File | Format | Authority |
| --- | --- | --- |
| [`update-feed.openapi.yaml`](./update-feed.openapi.yaml) | OpenAPI 3.1 | normative — the two reads, the closed set of manifest names, their status codes and range support |
| [`update-feed.schema.json`](./update-feed.schema.json) | JSON Schema 2020-12 | normative — the manifest document, served as YAML |

What the files fix is the shape and the reads. What they cannot express is the chain that makes an
unauthenticated feed safe: that the digest is checked against the downloaded bytes, that the package's
signature is checked against the operating system's trust provider, and — added at this version — that a macOS
package whose signing identity differs from the installed application's is refused rather than installed,
because installing it would cost the user their stored credentials and every permission they had granted.
Those are properties of the client, established in `spikes/SP-16-signing-update/macos/REPORT.md` §1 Q4 and
`spikes/SP-11-secure-storage/macos/REPORT.md` §1 Q3, which is why a manifest these files accept can still be
refused after download.

## Schema / Surface

A read-only HTTP surface, unauthenticated, with no session and no server-side decision.

| Channel | Direction | Interaction | Payload | Errors |
| --- | --- | --- | --- | --- |
| `GET /updates/latest.yml` | Client -> Backend | Request-Response | Content-Type `text/yaml`: the manifest, Windows | `404`, `500` |
| `GET /updates/latest-mac.yml` | Client -> Backend | Request-Response | Content-Type `text/yaml`: the manifest, macOS | `404`, `500` |
| `GET /updates/{filename}` | Client -> Backend | Request-Response, range-capable | `application/octet-stream` | `404`, `416` |

The set of manifest names is closed. A client asks for the one name that matches the machine it runs on, and
the architecture is carried inside the document rather than in a third name, because the two architectures of
one operating system differ in which artifact is installed and in nothing else.

## Semantics

**Per-architecture packages.** A macOS release publishes one archive and one disk image per architecture. The
archive is what `path` names, because the macOS updater installs from an archive; the disk image is a manual
download and is never named by the manifest. A package combining both architectures may be published for
manual download and is likewise never named here.

**Publishing for one operating system.** Publishing a release for one operating system leaves the other's
manifest untouched. Clients there see their current version as the latest and are offered nothing, which is a
404 or an unchanged version rather than an error.

**Refusing an unusable package.** A manifest naming a package format the reader's updater cannot apply is
rejected at publication. The alternative — discovering it on the user's machine — costs a failed update and a
deleted download for every client that reads the feed before it is corrected.

## Compatibility

Adding a manifest name for a further operating system is MINOR, as is adding an optional member to the
manifest document. Changing what an existing name serves, or removing one, is MAJOR: a released client's
updater has that name compiled into it and cannot be told a new one.

## Consumers

- `platform` — reads the manifest for its own operating system and architecture, verifies the package, and
  installs it.
- `app` — presents the restart prompt and defers installation while a job is running.

## Evidence

`spikes/SP-16-signing-update/macos/REPORT.md` §1 Q4 and §2 for the macOS manifest name, the archive
requirement and the per-architecture distribution; `spikes/SP-12-sqlite-ledger/macos/REPORT.md` §2 for why the
combined-architecture package stays out of the update path; `spikes/SP-16-signing-update/REPORT.md` §1 Q3 and
Q4 for the Windows half this version leaves unchanged.
