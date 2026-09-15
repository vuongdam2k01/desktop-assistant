import type Database from 'better-sqlite3';

export const RULE_CATALOGUE_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rule (
    id                     TEXT    PRIMARY KEY,
    representation_version TEXT    NOT NULL,
    name                   TEXT    NOT NULL,
    restatement            TEXT    NOT NULL,
    origin                 TEXT    NOT NULL DEFAULT 'user',
    verdict                TEXT    NOT NULL,
    condition_json         TEXT    NOT NULL,
    confirmed_at           TEXT    NOT NULL,
    updated_at             TEXT    NOT NULL,

    CONSTRAINT rule_origin_user_only CHECK (origin = 'user'),
    CONSTRAINT rule_verdict_closed CHECK (verdict IN ('refuse', 'hold', 'allow')),
    CONSTRAINT rule_name_present CHECK (length(trim(name)) > 0),
    CONSTRAINT rule_restatement_present CHECK (length(trim(restatement)) > 0)
);

CREATE TABLE IF NOT EXISTS allowlist_entry (
    id            TEXT PRIMARY KEY,
    connector     TEXT NOT NULL,
    tool          TEXT NOT NULL,
    object_type   TEXT NOT NULL,
    object_id     TEXT NOT NULL,
    added_at      TEXT NOT NULL,

    CONSTRAINT allowlist_entry_unique UNIQUE (connector, tool, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS rule_by_confirmation ON rule (confirmed_at DESC);
`;

/**
 * Initializes the rule catalogue database schema if tables do not exist.
 */
export function initializeRuleCatalogueSchema(db: Database.Database): void {
  db.exec(RULE_CATALOGUE_DDL);
}
