# Evolution: agent

Three contracts are introduced here and they evolve on three different clocks, which is why their versioning
rules read so differently.

`tool-wrapping` is internal to one build: both ends update together, nothing about it is ever written to disk, and
its version number exists for reviewers rather than for runtime negotiation. Its MAJOR conditions are therefore
written in terms of the security argument, not the shape of a signature — a change that is source-compatible and
moves the gate is still MAJOR, because the thing being versioned is the guarantee.

`agent-session` is half internal and half not. Its channels update with the build; its transcripts are written to
disk and replicate to devices that update at different times, so the turn shape has a real mixed-version window.

`provider-profile` is the one a user writes by hand. It replicates, it names an address and a credential, and a
misread member sends a request somewhere the user did not intend. It is the one place in this change where
forward compatibility is refused outright.

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `tool-wrapping` | The order of the four steps changes; any second way to obtain a `WrappedTool` appears; a `ToolImplementation` becomes reachable from outside its wrapper; the consequence of a verdict other than `allow` changes; a `declarations` member becomes optional for a writing tool; `refused` stops being a result and becomes a thrown failure, or the reverse. Each of these changes what the contract guarantees rather than what it looks like. | An optional member is added to `ToolImplementation`; a `WrapperErrorCode` is added whose handling is already covered by the rule that a failure never executes; a narrowed dependency is added; an origin kind strictly narrower than `connector` is added. | Wording, naming and examples that change neither what is accepted nor what happens. |
| `agent-session` | A `Turn` author is removed or changes meaning; the identity of a suspension point changes; any channel appears by which a window could start, resume or append to a session; the equivalence between a live resume and a rebuilt one is weakened; `tools` accepts anything other than `WrappedTool`; the transcript store's class or resolution rule changes. | A `TurnContent` kind is added, which older readers render as unreadable rather than dropping; an optional `SessionSpec` member is added; a read-only channel is added; a `SessionErrorCode` is added whose handling is already covered by the rule that a session which cannot start does not start. | Wording, naming and examples. |
| `provider-profile` | A dialect is removed, or what a dialect means changes; the credential moves into the profile record; any channel returns a resolved endpoint or a secret; `models` becomes optional; the credential key's shape changes. | A dialect is added; a `ModelCapability` is added; an optional member such as a per-model image floor is added; a shipped starting point is added; a read-only channel is added. Older profiles keep loading unchanged; a profile written against a *newer* minor is refused by an older build rather than partially read. | Wording, labels and examples. |

The asymmetry in the `provider-profile` MINOR row is deliberate and is the most consequential sentence in this
file. Backward compatibility is ordinary: a new build reads an old profile. Forward compatibility is refused: an
older build meeting a newer profile declines to use it and says so, and the roles routed to it start no jobs.
Reading around an unrecognised member here would mean sending a model request — with a credential attached — to
an endpoint assembled from a description the build only partly understood. In an account that replicates to
several machines, the older machine meets the newer profile routinely rather than exceptionally.

The `agent-session` MINOR row resolves the same tension in the opposite direction, and for a reason worth stating:
an unknown turn is displayed as unreadable and kept, because a transcript is the only explanation a user has of
what an agent did, and a conversation with silent holes in it is worse than one with a visible gap. Nothing is
executed on the strength of a turn, so reading around an unknown one costs nothing; a profile, by contrast, is
acted upon.

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| — (no predecessor) | `tool-wrapping@0.1.0` | Not applicable | None. No connector has been written and no application code exists. | The first MAJOR must state how existing connector manifests are converted and must re-run the bypass suite before shipping; the suite is what the contract's claim rests on. |
| — (no predecessor) | `agent-session@0.1.0` | Not applicable | None. No transcript exists in the field. | The `transcripts` store is registered with `req-022-account-sync` at the same time, so replication never meets an unregistered store. |
| `agent-session@0.x` | `agent-session@0.y` (MINOR, y > x) | Yes, by reading | Stored transcripts load unchanged; a turn kind the reader does not know renders as unreadable and is retained. | The reverse direction is not a migration either, for the same reason: an older reader degrades presentation and loses nothing. |
| `agent-session@N.x` | `agent-session@(N+1).0` (MAJOR) | Depends on the change | Stored turns are read as they were written, under the shape each turn declares. A MAJOR may not resolve itself by discarding transcripts: the ledger records the acts, and only the transcript records the reasoning. | A MAJOR that changes the suspension point's identity must also state what happens to runs suspended at the moment of the upgrade — the safe answer is that they are re-evaluated rather than resumed. |
| — (no predecessor) | `provider-profile@0.1.0` | Not applicable | None. | The shipped starting points are created at first run as ordinary profiles, not migrated from anything. |
| `provider-profile@N.x` | `provider-profile@(N+1).0` (MAJOR) | Partly | Every stored profile is rewritten into the new major by a conversion that runs once on the device. A profile that cannot be converted — typically because it names a removed dialect — is presented to the user for re-pointing, never deleted. | Deleting it would discard the user's own address and model list, which the product cannot regenerate, and would orphan a credential in secure storage that nothing would then clean up. |
| Any version, rolling back | An earlier build | No, for profiles | Every existing profile is a future profile to the reverted build, so the roles routed to those profiles start no jobs until the account rolls forward or the user re-creates a profile in the older shape. | Recorded in `design.md` §Migration & Rollback. It is cheaper to know this now than during an incident. |
| Engine version | A different pinned version | Manual, with evidence | Nothing stored changes. | The bypass, resume-equivalence and isolation suites are re-run before the pin is accepted, in both directions. The pin is what the measurements are attached to. |

## Deprecation

Two things in this change can be deprecated in a way a person notices: a provider dialect, and a turn kind.

1. **Announce.** The element is marked deprecated in its contract at a MINOR bump, naming the reason and the
   replacement. It keeps working exactly as before.
2. **Surface.** For a dialect, the application window marks every profile that uses it, states in the user's own
   words what will stop working and when, and offers the replacement. For a turn kind, no user-facing notice is
   needed — nothing the user owns depends on it — but the reader that renders it as unreadable must say which
   version introduced the replacement, so a support conversation is possible.
3. **Wait.** Not less than two release cycles and never less than 90 days between the announcement and the
   removal, measured from the release that announced it rather than from the commit. The wait exists because a
   person has to act, and people do not open provider settings every week.
4. **Remove.** A MAJOR bump with the migration above: profiles are converted where a mechanical replacement
   exists and presented for re-pointing where it does not.

Nothing in `tool-wrapping` is deprecated through this route. Its members are not stored anywhere and are not
written by anyone outside the build, so removing one is an ordinary MAJOR with no waiting period — but it is still
a MAJOR, and it still re-runs the bypass suite.

## Extension Procedure

**Adding a connector tool.** Declare it in the connector manifest with its full `declarations` block — whether it
writes, whether it is irreversible, whether it changes permission, how an interrupted call is reconciled, and how
its before state is read. Nothing in this change is edited. Test it with the registration path suite: an
incomplete declaration must be refused at registration, which is where the connector author sees it. The manifest
format itself is owned by `req-019-connector-framework`.

**Adding an internal tool.** The internal origin is a closed, enumerated set, so adding one is a change to this
capability rather than an extension of it. It still passes through the factory, still declares `writes: false`,
and still costs a record and a verdict. A proposal to add an internal tool that writes is a proposal to change
what internal means, and should be read as such.

**Adding a provider profile.** The user does it in settings, or ships as a starting point. Required: a display
name, an https address, a dialect the engine implements, a credential key, and at least one model with its
capabilities. Test it with `provider/probe`, which sends a real minimal request and reports what it observed
rather than what the profile claims.

**Adding a provider dialect.** A MINOR bump of `provider-profile` plus an implementation in the engine adapter —
the one module that names the engine. Test it with the provider suite against a real service, for a reasoning
model, a cheap model and a vision model, which is the shape of the evidence
`spikes/SP-6-pi-sdk/REPORT.md` §1 Q5 established for the first one.

**Replacing the engine.** Rewrite the engine adapter and nothing else; re-run the bypass, resume-equivalence and
isolation suites; re-pin. If a replacement requires changing anything above the adapter, this change's central
claim has been broken and the breach belongs in a proposal rather than in a refactor.

**Publishing an external guide.** The provider profile is the only descriptor a person outside the project
writes, so it is the only candidate for a guide under `docs/guides/`. It is generated from
`contracts/provider-profile.md` and this section; the prohibited patterns come from the trust boundary in
`model.md` — never place a secret in the profile, never use a plain-http address, never claim a capability the
probe does not observe.

## Reserved Slots

None. No slot is reserved by this change. The constitution permits a reserved point only where `model.md`
documents its phase, its rationale and the condition that activates it, and nothing here has one: the engine
adapter is a boundary rather than a reserved extension point, and the internal tool origin is deliberately closed.
Two things that might look like reserved slots are not. A second agent engine is not reserved — it is what the
adapter boundary makes possible, and it would arrive as a change with its own evidence. Additional agent roles are
not reserved here either; the role set belongs to `req-017-provider-matrix` and to the changes that introduce the
agents themselves.
