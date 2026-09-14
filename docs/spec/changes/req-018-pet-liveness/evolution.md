# Evolution: pet

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `privacy-filter@1.0.0` | Incompatible restructuring of `ScreenContextEvent` or adding unredacted personal identifiers | Adding new non-sensitive category classifications or additional geometric bounds | Tuning process regex matchers or categorization heuristics |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| Initial draft | `privacy-filter@1.0.0` | Yes | None | First implementation of the Zero-Persistent Title privacy boundary |

## Deprecation

Direct access to raw Win32 `GetWindowTextW` results outside the native privacy filter module is deprecated and forbidden. All screen reading must consume `SanitizedWindowContext`.

## Extension Procedure

To add support for classifying a new category of applications:
1. In `packages/native-windows/src/privacy_filter.rs`, add the classification pattern matching the executable process name (e.g. `slack.exe`, `discord.exe` -> `COMMUNICATION`).
2. Add the corresponding test assertion to `privacy-filter` unit test suite to verify no window title text is exposed.
3. Verify that `ScreenContextEvent` categorizes the window accurately while maintaining `INV-LIVE-01`.

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| Semantic Title Keyword Categorization | Phase 3 (Post-MVP) | Granular intent inference based on localized hash matching | Review and verification against Constitution Principle VII |
| Custom User-Defined Safe Zones | Phase 2 | Allow user to draw desktop boundary boxes where the pet is forbidden to enter | User requests custom UI exclusion zones |
