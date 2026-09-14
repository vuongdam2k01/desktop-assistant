-- Physical schema of the child job link relation, normative for
-- agent/contracts/job-delegation@1.0.0.
--
-- What this file owns: the one relation by which a device knows that a job was created by an agent running
-- another job. It sits beside the job records in the same Local Store file as the ledger relations, whose
-- configuration and shape-version marker are owned by ledger/contracts/ledger-store@0.1.0 and are not restated
-- here. The job record's own shape is owned by `job`; only the job identity this relation's foreign keys rest
-- on appears below, following the precedent ledger-store.sql sets.
--
-- What this file does not own. The shape of an assignment is contracts/job-delegation.schema.json, held below
-- as one structured-text column so that a change to the assignment shape is a change to that schema rather
-- than to this one. The delegation grant is not here at all: it is a member of a role entry, owned by
-- agent/contracts/role-registry@1.0.0, and it is read from the calling job's role at the delegation gateway.
--
-- The property this file exists to make visible: there is no second channel. A parent and a child are joined
-- by one row, and that row holds an identifier, a role, an assignment and a depth. There is no queue relation,
-- no message relation and no handle. A parent reads its children by reading job records, exactly as any other
-- reader of jobs does (INV-JOB-08), which is what makes principle I a property of the shape rather than a rule
-- the runtime has to keep.
--
-- The second property, which is an absence: there is no delegation result relation. A parent reads a child's
-- outcome from the child's own job record. A stored copy would be a second assertion of what a child did, and
-- it would go stale in the direction that tells a parent a failed child succeeded. It would also quietly make
-- a child's report look like a record the product wrote, when it is external content the child read
-- (INV-JOB-09).
--
-- What this file deliberately cannot enforce. The fan-out bound counts children that have not reached a
-- terminal state, which is a fact about job records rather than about links; it is enforced at the delegation
-- gateway, in the application layer, and a creation beyond it is refused with the bound named rather than
-- queued. The depth bound, by contrast, is enforced here: the only representable depth is 1, so a grandchild
-- is not a row this store can hold.
--
-- Evidence: no spike has measured delegation. Both bounds — one level of depth, four unfinished children — are
-- UNVERIFIED product choices. Their measured neighbour is concurrency against one connector account: eight
-- concurrent jobs crossed into platform refusals at about five percent while three completed cleanly,
-- spikes/SP-15-concurrency/REPORT.md section 1 Q4 (VERIFIED). The reference architecture's own defaults of two
-- levels and thirty-two concurrent workers (https://omp.sh/docs/subagents) are UNVERIFIED and not adopted. The
-- assignment ceiling below is a declared budget mirroring the role-instruction ceiling in model.md, not a
-- measurement. The scheduled measurement is SP-24 in design.md section R2.
--
-- Dialect: SQLite, following the Local Store. What is normative is the set of relations, their columns and
-- their constraints, not the spelling of a type name.

-- ── Relations ───────────────────────────────────────────────────────────────────────────────────────────

-- Identity only, restated so the foreign keys below have something to rest on. The job record's own shape,
-- including its state and timestamps, is owned by `job` and is not declared twice.
CREATE TABLE IF NOT EXISTS job (
    id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS job_child_link (
    -- The child is the key, not a surrogate. One link per child, enforced by the primary key: a job has at
    -- most one parent, and a second row claiming the same child is a contradiction the store refuses rather
    -- than a conflict some reader has to resolve.
    child_job_id     TEXT    PRIMARY KEY REFERENCES job(id),
    -- The job whose agent created the child. This single column is the whole difference between a child and
    -- any other job: the queue, the gate, the ledger obligation, the recovery and the cancellation are the
    -- same ones a job the user created passes through.
    parent_job_id    TEXT    NOT NULL REFERENCES job(id),
    -- The registry entry the child runs under. Denormalised out of the assignment document because the job
    -- tree listing and the fan-out check both read it, and because a device must be able to present a child
    -- without parsing the assignment.
    child_role_id    TEXT    NOT NULL,
    -- The whole assignment document, as validated against contracts/job-delegation.schema.json: the parent's
    -- text together with any external material it passed, each piece carrying its origin. Held whole rather
    -- than flattened into a text column, because flattening is precisely the concatenation INV-AG-39 forbids —
    -- material a parent read from a platform would arrive at the child indistinguishable from instruction the
    -- parent wrote. The ceiling is the one the schema's own members imply — 16 KiB of assignment text plus at
    -- most eight quoted inputs of 16 KiB each, with room for the encoding — and it is checked here as well as
    -- at the gateway because this relation replicates: a row arriving from another device meets the same rule
    -- that admitted it. The figure is a declared budget, not a measurement, and is UNVERIFIED.
    assignment       TEXT    NOT NULL CHECK (length(assignment) > 0 AND length(assignment) <= 262144),
    -- Always 1, and 1 is the only value the constraint admits. A child holds a row here, so a creation by that
    -- child would need depth 2, which this relation cannot store. Raising the bound is a MINOR revision of the
    -- contract, a revision of the schema file, and a store-shape change an older build refuses whole.
    depth            INTEGER NOT NULL CHECK (depth = 1),
    -- ISO-8601. Displayed, never used to order: ordering across devices is the replication protocol's causal
    -- position, not a clock on any one machine.
    created_at       TEXT    NOT NULL,
    -- A job is not its own parent. The cheapest of the three structural refusals, and the one that would
    -- otherwise produce a job waiting in `waiting_children` for itself.
    CONSTRAINT job_child_link_not_self CHECK (child_job_id <> parent_job_id)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────────────────────────────

-- Every read of this relation is by parent: the fan-out check counts a parent's unfinished children before
-- each creation, the job tree listing collects them, cancellation of a parent enumerates them to cascade, and
-- recovery reads them to decide whether a parent may be concluded. The child direction needs no index of its
-- own — it is the primary key, which is how a job answers 'am I a child' before delegating.
CREATE INDEX IF NOT EXISTS job_child_link_by_parent ON job_child_link (parent_job_id, created_at);
