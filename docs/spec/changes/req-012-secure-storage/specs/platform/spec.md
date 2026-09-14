## MODIFIED Requirements

### Requirement: Credentials are held in operating-system secure storage

Connector authorisations, model-provider credentials and the material a device uses to replicate the account's
data SHALL be encrypted through the operating system's secure-storage facility and held on the device only as
that ciphertext in the application's own credential store, SHALL NOT be written in plain text anywhere on the
device, and SHALL NOT be placed in an operating-system credential vault that limits the size of an entry or
lists the product's entries among the user's own saved credentials.

Source: `docs/raw-idea/prd-mvp.md#11-3-bao-mat-amp-rieng-tu` (NFR-SEC-01),
`docs/raw-idea/prd-mvp.md#10-2-module-he-agent-ag` (FR-AG-11), `docs/spec/constitution.md` principle VII,
`spikes/SP-11-secure-storage/REPORT.md#0-ket-luan`, `spikes/SP-11-secure-storage/macos/REPORT.md#0-ket-luan` — VERIFIED on Windows and macOS. The mechanism is
now named rather than left open: the measurement in `spikes/SP-11-secure-storage/REPORT.md` §1 Q2 and `spikes/SP-11-secure-storage/macos/REPORT.md` §1 Q2 eliminated the
operating-system credential vault on a hard per-entry limit, and `#2-tac-dong-len-adr-prd` records that the
wording of NFR-SEC-01, which named that vault, is what this requirement corrects. `req-022-account-sync` had
already added replication material to what this requirement protects and removed the binding of these
credentials to one machine; that is carried forward unchanged.

#### Scenario: Credential is not recoverable from the application directory
- **WHEN** the application's data directory is inspected
- **THEN** no credential value is readable from it, including from the credential store file that holds the
  ciphertext

#### Scenario: Secure storage is unavailable
- **WHEN** the operating system's secure storage cannot be reached
- **THEN** the product reports that credentials cannot be stored and refuses to hold them in plain text as a
  fallback

#### Scenario: A credential larger than an operating-system credential vault would accept
- **WHEN** a credential whose stored form exceeds two and a half kilobytes — a connector's tokens, scopes and
  platform metadata held together, or a user-supplied authorisation client — is stored
- **THEN** it is stored and read back whole, without being divided into numbered parts

#### Scenario: The product's credentials do not appear among the user's own saved credentials
- **WHEN** the user inspects the operating system's list of saved credentials
- **THEN** none of the product's credentials is listed there, so removing the product cannot leave entries
  behind in it

#### Scenario: Credentials are removed on uninstall or account deletion
- **WHEN** the account is deleted or the application is removed
- **THEN** the stored credentials are erased from secure storage

#### Scenario: Stored credentials cannot be decrypted on this device
- **GIVEN** the device's secure storage can no longer decrypt what it holds
- **WHEN** the user signs in to the account
- **THEN** the unreadable material is discarded and the credentials are restored by replication, and the user is
  not asked to reconnect each connector

#### Scenario: Credentials are erased on sign-out
- **WHEN** the user signs out on a device
- **THEN** the connector authorisations, provider credentials and replication material held for that account are
  erased from that device's secure storage

## ADDED Requirements

### Requirement: Every stored credential is addressed by a namespaced key

Every credential SHALL be stored under a hierarchical key that names the domain it belongs to, the provider or
category within that domain and the identity it was issued for, and the store SHALL be enumerable by key prefix
so that everything belonging to one connector, one provider or one account can be found and removed as a group.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q5 — VERIFIED; the five key forms of the taxonomy were
written, read back and enumerated by prefix, and `#3-dau-vao-cho-tai-lieu-ky-thuat` item 2 carries the naming
rule into the technical input.

#### Scenario: Two accounts on the same provider do not collide
- **GIVEN** the user has authorised the same platform for two different accounts on it
- **WHEN** both authorisations are stored
- **THEN** each is addressable on its own and neither overwrites the other

#### Scenario: Everything belonging to one connector is found by prefix
- **WHEN** a connector is disconnected
- **THEN** every entry belonging to it — tokens, any user-supplied authorisation client, and its stored
  metadata — is found by its key prefix and erased, leaving no entry that only a full scan would reveal

#### Scenario: Storing under a key already in use replaces it
- **WHEN** a refreshed token is stored under the key its predecessor used
- **THEN** the entry holds the new value and no copy of the previous value remains readable

#### Scenario: A key that does not follow the naming rule is refused
- **WHEN** a credential is offered under a key that names no domain and no identity
- **THEN** the store refuses it and nothing is written, rather than accepting an entry that group erasure would
  later miss

### Requirement: A credential that cannot be decrypted is never returned as a value

When stored ciphertext cannot be decrypted, the store SHALL report the failure to its caller, SHALL NOT return a
partial, empty or substituted value in its place, and SHALL mark the entry unreadable so that it is replaced
rather than read again.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q3 — VERIFIED; every tampered, truncated and
foreign-format payload raised a decryption failure rather than yielding a value, and `#4-rui-ro-moi-phat-hien`
records the out-of-band password reset (RISK-042) as the realistic cause of this state on a machine nobody has
attacked.

#### Scenario: The stored ciphertext has been altered
- **WHEN** an entry whose stored bytes have been altered is read
- **THEN** the read fails and reports that the credential is unreadable, and no value is returned to the caller

#### Scenario: Material written in a form this device does not recognise
- **WHEN** an entry is read whose stored form is truncated or was written under a scheme this device does not
  recognise
- **THEN** it is treated as unreadable in the same way, rather than being parsed on a best-effort basis

#### Scenario: An unreadable connector authorisation is replaced from the account
- **GIVEN** a connector's stored authorisation is unreadable on this device
- **WHEN** the device next replicates with the account
- **THEN** the unreadable entry is replaced by the account's copy and jobs use the connector again without the
  user re-authorising it

#### Scenario: The device cannot yet reach the account
- **GIVEN** a connector's stored authorisation is unreadable and the device has not replicated since
- **WHEN** the user opens the product
- **THEN** it states which connections are unavailable on this device and that they are being restored, keeps
  that statement visible until they are, and does not present them as revoked at the platform

#### Scenario: The replication material itself is unreadable
- **GIVEN** the material this device uses to replicate is unreadable, so the account's copy cannot be reached
  to replace it
- **WHEN** the user opens the product
- **THEN** the product asks only for account sign-in, and re-establishes the device's replication material and
  every credential from that sign-in alone

### Requirement: Stored credentials are readable only by the operating-system user that stored them

A credential stored on a device SHALL be readable only by the operating-system user account that stored it, and
copying the application's data directory to another operating-system user account or to another machine SHALL
NOT make any credential in it readable.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q4 — VERIFIED; a second operating-system user created for the
measurement failed to decrypt the first user's material, and the same section records that a restored copy of
the data directory on another machine fails in the same way.

#### Scenario: A second operating-system user reads the data directory
- **GIVEN** two operating-system user accounts exist on one machine and the first has stored credentials
- **WHEN** the second reads the first's application data directory
- **THEN** no credential in it is readable, even though the file itself can be opened

#### Scenario: The data directory is restored onto a different machine
- **GIVEN** a backup of the application's data directory taken on one machine
- **WHEN** it is restored onto another machine and the product starts
- **THEN** the credentials in it are unreadable, the product does not crash, and they are replaced from the
  account rather than being trusted

### Requirement: A decrypted credential never leaves the process that uses it

A decrypted credential value SHALL be used only inside the process that makes the call it authorises, and SHALL
NOT be sent to a window process, written to the ledger, placed in an agent's context, or written to a log or a
crash report.

Source: `docs/spec/constitution.md` principles II and III;
`docs/spec/changes/req-013-sqlite-ledger/contracts/ledger-store.md` Semantics, which states that credentials are
not in the ledger store at all — UNVERIFIED as a whole; the storage half is measured in
`spikes/SP-11-secure-storage/REPORT.md` §1 Q5, while the boundary rule is a design obligation this change places
on every caller.

#### Scenario: A window process asks for a credential
- **WHEN** a window process requests a credential value
- **THEN** no value is returned to it; it receives only whether the credential is present and when it was last
  updated

#### Scenario: A tool call is recorded in the ledger
- **WHEN** a tool call authorised by a stored credential is recorded
- **THEN** the record names the connector and the operation, and contains no part of the credential value

#### Scenario: The product writes a diagnostic report
- **WHEN** a log line or a crash report is produced while a credential is in use
- **THEN** no credential value appears in it

### Requirement: Erasing the device's credentials leaves nothing readable behind

Erasing the device's credentials SHALL remove every stored entry and discard every decrypted copy the product
holds, SHALL complete before the local store file is removed, and an interrupted erasure SHALL be completed at
the next start rather than leaving a readable credential behind.

Source: `spikes/SP-11-secure-storage/REPORT.md` §1 Q6 — VERIFIED; after erasure the store file was gone, no key
remained in memory, a read returned nothing, and no entry was left in the operating system's own credential
list. `docs/raw-idea/prd-mvp.md#10-8-module-backend-service-be` (FR-BE-12) is the requirement it answers.

#### Scenario: The account is deleted
- **WHEN** the user deletes their account
- **THEN** every credential on the device is erased before the local store file is removed, and a read afterwards
  returns nothing

#### Scenario: The application is uninstalled
- **WHEN** the product is removed from the machine
- **THEN** the erasure runs as part of the removal, and nothing readable is left in the application's data
  directory or in the operating system's credential list

#### Scenario: Erasure is interrupted part-way
- **GIVEN** an erasure was interrupted with some entries still present
- **WHEN** the product next starts
- **THEN** it completes the erasure before any other use of the store, and no credential is usable in between

#### Scenario: There is nothing to erase
- **WHEN** erasure runs on a device that holds no credentials
- **THEN** it completes successfully and reports that nothing was held, rather than failing
