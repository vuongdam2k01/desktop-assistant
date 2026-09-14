-- Physical schema of the device-resident agent runtime store, normative for
-- agent/contracts/role-registry@1.0.0.
--
-- What this file owns: the relations by which a device knows which roles exist and what each one declares,
-- which skills it may load and whether each is enabled, and which capability packs have met their activation
-- condition. It lives in the same Local Store file as the ledger relations, whose configuration and
-- shape-version marker are owned by ledger/contracts/ledger-store@0.1.0 and are not restated here.
--
-- Why one file for three contracts. The role registry owns this schema, but the skill catalogue's enabled
-- state (agent/contracts/skill-manifest@1.0.0) and capability-pack activation
-- (agent/contracts/capability-pack@1.0.0) are recorded beside it, because all three are read in the same
-- instant — when an agent is started — and a role entry's allowlist and its preloaded skills are only
-- resolvable against the other two. What each of those contracts owns is the shape of its own document; what
-- this file owns is where the rows sit and what the database will refuse.
--
-- What this file does not own. The shape of a role entry is contracts/role-registry.schema.json, held below as
-- one structured-text column so that a change to the entry shape is a change to that schema rather than to
-- this one — the precedent is pet/contracts/pet-pack-manifest@1.0.0. Which model a tier resolves to is the
-- routing table, a store of its own (agent/contracts/role-routing@1.0.0); nothing here records a provider, a
-- model or a credential, because an entry that could name one would be a second path from a role to a model
-- (INV-AG-31). The backend side is not declared here at all: the backend holds every replicated store in one
-- generic relation owned by sync/contracts/replication-protocol@0.1.0, so the registry needs no server table —
-- it needs a descriptor, which is contracts/role-registry.descriptor.json.
--
-- The property this file exists to make visible: a skill's body is not in the database. The catalogue holds an
-- identifier, an applicability line, an origin and a validity; the body and the reference material it cites are
-- files under the package directory, read only when a job loads that skill. That separation is what lets a
-- large catalogue be advertised to every agent at the start of every job without reading a single body, which
-- is the context cost the whole skill mechanism exists to reduce.
--
-- The second property, less visible but more load-bearing: built-in role entries are rows like any other and
-- are rewritten at every start. A replicated document therefore cannot redefine the identity the gate's
-- second-tier evaluation or the undo agent runs under; it can only lose to materialisation.
--
-- Evidence: no spike has measured a role registry, a skill catalogue or a pack loader. Every size and count
-- ceiling below is a declared budget from clarifications.md session 2026-09-13 and is UNVERIFIED;
-- verification.md schedules the measurement that would replace them. What is VERIFIED, and is the reason the
-- tool allowlist can be held as plain text here rather than as a permission structure, is that every tool in
-- this product is produced by one wrapping factory and every call it makes crosses the ledger write and the
-- approval gate (spikes/SP-6-pi-sdk/REPORT.md §1 Q1, Q2) — so a row in this file can widen nothing.
--
-- Dialect: SQLite, following the Local Store. What is normative is the set of relations, their columns and
-- their constraints, not the spelling of a type name.

-- ── The role registry ───────────────────────────────────────────────────────────────────────────────────

-- One row per role identifier. The three origins share one relation deliberately: they resolve identically at
-- the moment an agent starts, and a privileged kind of entry would be exactly the second route to identity
-- that INV-AG-30 exists to close.
CREATE TABLE IF NOT EXISTS role_entry (
    role_id            TEXT    PRIMARY KEY,
    -- The version of agent/contracts/role-registry the entry document was written against. A row whose value
    -- is ahead of this assembly is not read around: the whole replicated document is refused
    -- (REGISTRY_VERSION_AHEAD) before any entry in it is examined, because reading around an unrecognised
    -- member would mean running work under an allowlist the user never assigned.
    schema_version     TEXT    NOT NULL,
    -- 'built-in' rows are rewritten by the product at every start and are never replicated. 'account' rows are
    -- the user's and replicate under contracts/role-registry.descriptor.json. 'pack' rows arrive when a
    -- capability pack activates and are deleted when it deactivates; a job already running keeps the tool set
    -- it started with regardless (INV-AG-33), so a withdrawal never changes what a running agent holds.
    origin             TEXT    NOT NULL CHECK (origin IN ('built-in', 'account', 'pack')),
    -- Null unless origin = 'pack'. Not a foreign key onto capability_pack: a pack's rows are removed with the
    -- pack in one operation, so a dangling reference is a bug rather than a state to model.
    source_pack_id     TEXT,
    -- Advanced on every edit. Carried so that a replication edit which lost can be preserved against the one
    -- that won: both rows share role_id and differ here.
    entry_version      TEXT    NOT NULL,
    -- The whole entry document as validated against contracts/role-registry.schema.json. Held whole rather
    -- than decomposed into columns because the entry is the unit that replicates and the unit that is
    -- validated; splitting it would create a second place where its shape is asserted.
    entry              TEXT    NOT NULL,
    -- Denormalised out of the document because every listing joins it against the routing table to answer
    -- 'can this role produce an agent right now', and because that question must be answerable without parsing
    -- every entry. It holds a tier name and never a provider, a model or a credential (INV-AG-31); a value
    -- that is not a tier is refused at upsert as TIER_MALFORMED and never reaches this column.
    tier               TEXT    NOT NULL,
    -- Denormalised for the same reason: the delegation gateway asks 'may this role create a job' on a path
    -- where parsing the document would be wasted work. 0 when the entry carries no grant, which is a different
    -- statement from a grant naming nobody — a grant must name at least one role or the entry is invalid.
    may_delegate       INTEGER NOT NULL CHECK (may_delegate IN (0, 1)),
    -- 'valid' or 'invalid'. An entry that fails a check the schema cannot make — a delegation grant naming an
    -- identifier nothing holds, an instructions field over its ceiling — is kept as a row so that the role can
    -- be listed as unstartable with the failing field named, rather than silently vanishing. Built-in rows are
    -- always 'valid': the product writes them.
    validity           TEXT    NOT NULL CHECK (validity IN ('valid', 'invalid')),
    -- The member that failed, for an 'invalid' row. Null otherwise. Never a reason phrase: the phrasing is the
    -- interface's, the field name is the fact.
    invalid_field      TEXT,
    -- Refused above 16384 at upsert, so an oversize entry never reaches replication. The constraint is here as
    -- well as at the upsert path because this store replicates: a row arriving from another device is checked
    -- by the same rule that admitted it. UNVERIFIED — a declared budget, not a measurement.
    instructions_bytes INTEGER NOT NULL CHECK (instructions_bytes > 0 AND instructions_bytes <= 16384),
    -- ISO-8601. Displayed, never used to order: ordering across devices is the replication protocol's causal
    -- position, not a clock on any one machine.
    created_at         TEXT    NOT NULL,
    updated_at         TEXT    NOT NULL,
    CHECK ((origin = 'pack') = (source_pack_id IS NOT NULL)),
    CHECK ((validity = 'invalid') = (invalid_field IS NOT NULL))
);

-- The registry document's own version marker, and whether this assembly accepted it. One row, because there is
-- one registry per account. It exists separately from the entries so that REGISTRY_VERSION_AHEAD is a
-- recordable state rather than an inference from an empty table: a refused document must be distinguishable
-- from an account that has simply added no role of its own, since the first asks the user for an update and
-- the second is a perfectly ordinary device.
CREATE TABLE IF NOT EXISTS role_registry_document (
    id                 INTEGER PRIMARY KEY CHECK (id = 1),
    -- The schemaVersion of the replicated document last seen, accepted or not.
    schema_version     TEXT    NOT NULL,
    -- 'accepted' or 'refused-version-ahead'. While refused, no account or pack entry starts an agent and the
    -- six built-in rows still resolve, so the product's own work continues (INV-AG-30 holds either way).
    state              TEXT    NOT NULL CHECK (state IN ('accepted', 'refused-version-ahead')),
    evaluated_at       TEXT    NOT NULL
);

-- ── The skill catalogue ─────────────────────────────────────────────────────────────────────────────────

-- What this device discovered, including what it shadowed. Keyed by identifier AND source, because two
-- packages declaring one identifier never merge: exactly one is selected by declared precedence and the other
-- is recorded here rather than discarded (INV-AG-35). A merged playbook is a playbook nobody wrote, and a
-- silently dropped one is a playbook nobody can find.
CREATE TABLE IF NOT EXISTS skill_catalogue_entry (
    skill_id        TEXT    NOT NULL,
    -- 'product' for the product's own skill directory, or the pack identifier for an activated pack's.
    source_id       TEXT    NOT NULL,
    origin          TEXT    NOT NULL CHECK (origin IN ('product', 'pack')),
    -- Declared rather than derived from the order the sources were discovered in, so that two devices holding
    -- the same packages resolve the same identifier to the same body. Lower rank wins.
    precedence_rank INTEGER NOT NULL,
    -- 1 for the row that won its identifier, 0 for a shadowed one. Exactly one row per skill_id carries 1
    -- among valid rows; the shadowed rows remain listable so the interface can name both sources and state
    -- which is in effect.
    in_effect       INTEGER NOT NULL CHECK (in_effect IN (0, 1)),
    -- The applicability line — what work this playbook is for. This, and not the body, is what every agent is
    -- shown at the start of every job, which is why it is a column and the body is a file.
    applies_to      TEXT    NOT NULL,
    -- Excluded from automatic matching while remaining loadable by identifier.
    hidden          INTEGER NOT NULL CHECK (hidden IN (0, 1)),
    -- 'valid' or 'invalid'. A package is loaded whole or not at all: a manifest missing its applicability, a
    -- named reference file that cannot be read, or a path that leaves the package directory each make the
    -- package invalid here rather than half-loaded, because a playbook missing the material it cites is a
    -- playbook that misleads.
    validity        TEXT    NOT NULL CHECK (validity IN ('valid', 'invalid')),
    invalid_field   TEXT,
    -- Relative to the source's skill directory, one directory deep. Never absolute and never containing a
    -- parent segment: that constraint is what confines a package to its own directory, and it is enforced at
    -- discovery as well as here.
    package_dir     TEXT    NOT NULL,
    -- Body plus named reference material, refused above 262144 at discovery. UNVERIFIED — a declared budget.
    content_bytes   INTEGER NOT NULL CHECK (content_bytes >= 0 AND content_bytes <= 262144),
    discovered_at   TEXT    NOT NULL,
    PRIMARY KEY (skill_id, source_id),
    CHECK ((validity = 'invalid') = (invalid_field IS NOT NULL)),
    CHECK (NOT (validity = 'invalid' AND in_effect = 1))
);

-- Whether the account wants an identifier available at all. Keyed by identifier alone, and separate from the
-- catalogue rows above, because this is the one part of the catalogue that replicates: the packages arrive
-- with the product or with a pack and are not account data, while the decision to enable one is. A skill with
-- no row here is enabled — the default is the product's, and a row exists only where the user has decided
-- otherwise, so that a newly shipped skill is not silently disabled on a device that has never seen it.
CREATE TABLE IF NOT EXISTS skill_enabled_state (
    skill_id     TEXT    PRIMARY KEY,
    enabled      INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    set_at       TEXT    NOT NULL
);

-- ── Capability pack activation ──────────────────────────────────────────────────────────────────────────

-- One row per pack the product ships. Activation is evidence-bound rather than user-settable, so the row
-- records which evidence satisfied the condition and not which toggle was flipped — there is no toggle, and
-- no channel exposes one. Without an 'active' row a pack's tools, roles and skills do not exist at all: not a
-- tool that refuses, not a role that cannot run, not a skill describing an impossibility (INV-AG-45).
CREATE TABLE IF NOT EXISTS capability_pack (
    pack_id              TEXT    PRIMARY KEY,
    -- The version of agent/contracts/capability-pack the pack manifest was written against. A pack written
    -- against a later version is 'invalid' and contributes nothing; the product runs with its built-in roles,
    -- skills and connector tools.
    schema_version       TEXT    NOT NULL,
    pack_version         TEXT    NOT NULL,
    -- The lifecycle in model.md: a discovered pack is invalid, inactive or active, and only an active one
    -- contributes. 'inactive' is the state browser automation and desktop control ship in.
    state                TEXT    NOT NULL CHECK (state IN ('invalid', 'inactive', 'active')),
    invalid_field        TEXT,
    -- What must be true before this pack's tools may exist, in the words the user is shown when they ask why
    -- the product cannot open a page.
    activation_condition TEXT    NOT NULL,
    -- The evidence that satisfied it — a reference to a spike report under spikes/. Null while inactive, which
    -- is the honest state for a capability whose behaviour on this platform has not been measured. Supplier
    -- documentation is never an architectural conclusion in this project, so it can never appear here.
    evidence_reference   TEXT,
    evidence_recorded_at TEXT,
    -- Declarative content: manifest, contributed role entries and contributed skill manifests. Refused above
    -- 1048576 at load. UNVERIFIED — a declared budget.
    declared_bytes       INTEGER NOT NULL CHECK (declared_bytes > 0 AND declared_bytes <= 1048576),
    updated_at           TEXT    NOT NULL,
    CHECK ((state = 'invalid') = (invalid_field IS NOT NULL)),
    CHECK ((state = 'active') = (evidence_reference IS NOT NULL))
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────────────────

-- The role list groups shipped roles and the account's own, and badges the unstartable ones.
CREATE INDEX IF NOT EXISTS role_entry_by_origin ON role_entry (origin, validity);

-- Answering 'which roles wait on this tier' when an assignment changes, which is what registry/state
-- publishes. The routing table holds the other half of that join and lives in its own store.
CREATE INDEX IF NOT EXISTS role_entry_by_tier ON role_entry (tier);

-- Withdrawing a pack's contributions in one statement when it deactivates.
CREATE INDEX IF NOT EXISTS role_entry_by_source_pack ON role_entry (source_pack_id);

-- Advertising the catalogue at the start of every job: the identifiers and applicability lines that are in
-- effect, valid and not hidden, without touching a shadowed row or a body.
CREATE INDEX IF NOT EXISTS skill_catalogue_in_effect ON skill_catalogue_entry (in_effect, validity, hidden);
