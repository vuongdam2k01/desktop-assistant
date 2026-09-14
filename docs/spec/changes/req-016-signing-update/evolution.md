# Evolution: req-016-signing-update

## Versioning Policy

| Contract | MAJOR When | MINOR When | PATCH When |
| --- | --- | --- | --- |
| `update-feed@1.0.0` | Manifest filename renamed from `latest.yml`, required schema properties renamed or removed (e.g. `files`, `sha512`), or breaking transport protocol changes | New optional properties added to manifest (e.g. `releaseNotes`, `stagingPercentage`, `minimumOsVersion`, `mandatoryUpdate`) | Non-breaking URL origin adjustments, cache control header tuning, or documentation fixes preserving wire compatibility |

## Migration Paths

| From | To | Automated? | Legacy Data | Notes |
| --- | --- | --- | --- | --- |
| `update-feed@1.0.0` | `update-feed@1.1.0` | Yes | None | Client ignores unknown additional fields in YAML manifest; backward compatible |
| Self-Signed Dev Cert | Commercial Cloud Certificate | Manual | None | Switching signing certificate in CI runner does not break client updates if commercial cert chains to Windows Trusted Root |

## Deprecation

- **Old Release Binaries**: The backend retains historical installers (`.exe`) and blockmaps (`.blockmap`) for at least 3 minor versions before archiving.
- **Notice Period**: 30 days notice before retiring support for legacy client builds that cannot parse new manifest versions.
- **Consumer Identification**: Electron updater sends standard User-Agent header (`DesktopAssistant/<version> (Windows; Win64; x64)`) on all manifest and binary GET requests, allowing server-side access log telemetry to monitor lingering old versions.

## Extension Procedure

### Adding macOS Code Signing and Update Channel
1. **Define macOS Feed Contract**: Add `latest-mac.yml` endpoint following the existing `UpdateManifestYaml` schema with `.dmg` or `.zip` file entries.
2. **Apple Developer ID Setup**: Procure Apple Developer Organization account ($99/year), generate "Developer ID Application" certificate, and store credentials in CI secrets.
3. **Hardened Runtime & Notarization**:
   - In `electron-builder.json`, configure `mac.hardenedRuntime: true`, `mac.gatekeeperAssess: false`, and `mac.entitlements`.
   - Add CI notarization step using `xcrun notarytool submit` with App Store Connect API keys.
   - Run `xcrun stapler staple` on the generated package.
4. **Backend Route Registration**: Ensure backend static route serves `latest-mac.yml` alongside `latest.yml`.
5. **Validation**: Execute macOS dry-run update verifying Gatekeeper acceptance (`spctl --assess --type execute -v <binary>`).

## Reserved Slots

| Reserved Point | Target Phase | Reservation Rationale | Activation Condition |
| --- | --- | --- | --- |
| `macos_signing_pipeline` | Post-M1 / M2 | macOS platform support deferred per roadmap §3.6 | Apple Developer Account procured and macOS runners available |
| `staged_rollout_distribution` | M2 | Phased percentage-based rollout to limit blast radius of regressions | Active user base exceeds 1,000 installations |
