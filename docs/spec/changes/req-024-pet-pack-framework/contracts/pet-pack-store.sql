-- Physical schema of the device-resident pet pack store, normative for
-- pet/contracts/pet-pack-manifest@1.0.0.
--
-- What this file owns: the relations by which a device knows which packs exist, what each one declares, and
-- which one is active. It lives in the same Local Store file as the ledger relations, whose configuration and
-- shape-version marker are owned by ledger/contracts/ledger-store@0.1.0 and are not restated here.
--
-- What this file does not own. The shape of a manifest is contracts/pet-pack-manifest.schema.json, held below
-- as one structured-text column so that a change to the manifest shape is a change to that schema rather than
-- to this one. The backend side is not declared here at all: the backend holds every replicated store in one
-- generic relation owned by sync/contracts/replication-protocol@0.1.0, so a pack needs no server table — it
-- needs a descriptor, which is contracts/pet-pack-store.descriptor.json.
--
-- The property this file exists to make visible: the animation asset is not in the database. The manifest and
-- the persona are rows; the binary is a file beside them, addressed by digest. That separation is what lets the
-- library list every pack without reading a single asset, and what lets a pack exist in the 'arriving' state
-- with its record present and its bytes still in transit.
--
-- Evidence: no spike has measured a replicated store carrying a binary payload. The size ceiling below is a
-- declared budget from clarifications.md session 2026-09-13, not a measurement, and is UNVERIFIED.
--
-- Dialect: SQLite, following the Local Store. What is normative is the set of relations, their columns and
-- their constraints, not the spelling of a type name.

-- ── Relations ───────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pet_pack (
    pack_id            TEXT    PRIMARY KEY,
    -- Advanced on every edit. Carried so that a replication edit which lost can be preserved against the one
    -- that won: both rows share pack_id and differ here.
    pack_version       TEXT    NOT NULL,
    -- 'built-in-template' or 'account-pack'. Immutable once written (INV-PACK-01); a row changing provenance
    -- is a different pack and therefore a different pack_id.
    provenance         TEXT    NOT NULL CHECK (provenance IN ('built-in-template', 'account-pack')),
    -- The whole manifest document, including the persona, as validated against
    -- contracts/pet-pack-manifest.schema.json. Held whole rather than decomposed into columns because the
    -- manifest is the unit that replicates and the unit that is validated; splitting it would create a second
    -- place where its shape is asserted.
    manifest           TEXT    NOT NULL,
    -- Denormalised out of the manifest because every library listing and every activation reads them, and
    -- because a device must be able to answer 'can this build present this pack' without parsing the document.
    target_contract_major INTEGER NOT NULL,
    -- 'installed', 'arriving', 'damaged' or 'incompatible'. The lifecycle the model records. 'arriving' exists
    -- because the descriptor declares the partial-transfer capability: the row lands before the bytes do.
    state              TEXT    NOT NULL CHECK (state IN ('installed', 'arriving', 'damaged', 'incompatible')),
    -- sha256: of the asset the manifest names. The asset file is verified against this at arrival and at load;
    -- a mismatch sets state to 'damaged' rather than repairing anything.
    asset_digest       TEXT    NOT NULL,
    -- Refused above 5242880 at import, so an oversize pack never reaches replication. The constraint is here
    -- as well as at the import path because this store replicates: a row arriving from another device is
    -- checked by the same rule that admitted it.
    asset_size_bytes   INTEGER NOT NULL CHECK (asset_size_bytes > 0 AND asset_size_bytes <= 5242880),
    -- ISO-8601. Displayed, never used to order: ordering across devices is the replication protocol's
    -- causal position, not a clock on any one machine.
    created_at         TEXT    NOT NULL,
    updated_at         TEXT    NOT NULL
);

-- Which pack is active. One row, because exactly one pack is active per account (INV-PACK-04) and this is an
-- account-level choice that replicates rather than a per-device preference. The single-row shape is enforced
-- rather than conventional, so that two devices cannot each believe they hold a different valid selection.
CREATE TABLE IF NOT EXISTS pet_pack_selection (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    -- Never null. There is no state in which no pack is selected: if a selection would be removed, the
    -- shipped default pack takes its place in the same operation (INV-PACK-04, INV-PACK-05).
    pack_id       TEXT    NOT NULL REFERENCES pet_pack(pack_id),
    selected_at   TEXT    NOT NULL
);

-- Which capabilities were actually bound the last time this pack was activated, as opposed to what its
-- manifest declares. Written by the renderer at activation, because the asset rather than the declaration is
-- the authority (INV-PACK-06), and read by the library so that a pack can be listed as borrowing default
-- locomotion before the user activates it a second time.
CREATE TABLE IF NOT EXISTS pet_pack_bound_capability (
    pack_id     TEXT NOT NULL REFERENCES pet_pack(pack_id) ON DELETE CASCADE,
    capability  TEXT NOT NULL CHECK (capability IN ('work-status', 'locomotion')),
    -- True when the pack's own asset supplied it; false when the shipped default pack was substituted for
    -- this capability alone.
    from_pack   INTEGER NOT NULL CHECK (from_pack IN (0, 1)),
    PRIMARY KEY (pack_id, capability)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────────────────

-- The library lists by provenance, presenting templates and the account's own packs as separate groups.
CREATE INDEX IF NOT EXISTS pet_pack_by_provenance ON pet_pack (provenance, state);
