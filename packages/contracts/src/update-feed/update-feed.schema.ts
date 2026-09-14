/**
 * Shape of the update manifest published beside a release and read by the client updater, for backend/contracts/update-feed@1.1.0. One manifest describes one release for one operating system and one processor architecture; the client reads the manifest belonging to the machine it runs on, so the file never has to describe a package the reader cannot install. The manifest is served as YAML and unauthenticated, which it can afford to be only because nothing in it is trusted on its own: the digest below is checked against the downloaded bytes and the downloaded package is checked against the operating system's trust provider before anything is installed. What the file cannot express is exactly that chain, nor that a package signed with an identity other than the installed application's is refused rather than installed (spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q4; spikes/SP-11-secure-storage/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q3), which is why a manifest this file accepts can still be refused after download. Unknown members are admitted on purpose: adding optional metadata is a MINOR change, and an older client ignoring a member it does not know is how that stays true.
 */
export interface UpdateManifest {
  /**
   * The version being offered. The client compares it against its own and treats anything not greater as no update, so a feed rolled back to an earlier version offers nothing rather than downgrading.
   */
  version: string;
  /**
   * The artifacts of this release. A manifest declaring none is malformed rather than empty: there would be nothing to verify and nothing to install.
   *
   * @minItems 1
   */
  files: [
    {
      /**
       * The artifact's name, resolved against the feed's own location. It is a name rather than an absolute address so that moving the release to another origin is a PATCH change. On macOS the installable artifact is the archive rather than the disk image, because the macOS updater installs from an archive; the disk image is published for manual download and is not named by path.
       */
      url: string;
      /**
       * Base64 SHA-512 digest of the artifact. It is what a downloaded file is judged against; a mismatch deletes the cached file and fails the update rather than installing it.
       */
      sha512: string;
      /**
       * Artifact size in bytes, which is what lets the download be resumed by range and its progress be shown honestly.
       */
      size: number;
      /**
       * Size of the companion block map when one is published. Present only for a differential download; its absence means the whole artifact is fetched.
       */
      blockMapSize?: number;
      [k: string]: unknown;
    },
    ...{
      /**
       * The artifact's name, resolved against the feed's own location. It is a name rather than an absolute address so that moving the release to another origin is a PATCH change. On macOS the installable artifact is the archive rather than the disk image, because the macOS updater installs from an archive; the disk image is published for manual download and is not named by path.
       */
      url: string;
      /**
       * Base64 SHA-512 digest of the artifact. It is what a downloaded file is judged against; a mismatch deletes the cached file and fails the update rather than installing it.
       */
      sha512: string;
      /**
       * Artifact size in bytes, which is what lets the download be resumed by range and its progress be shown honestly.
       */
      size: number;
      /**
       * Size of the companion block map when one is published. Present only for a differential download; its absence means the whole artifact is fetched.
       */
      blockMapSize?: number;
      [k: string]: unknown;
    }[]
  ];
  /**
   * The artifact the client installs, named among the entries in files. It exists because a release may publish more than one artifact while only one of them is the installer for this platform.
   */
  path: string;
  /**
   * Digest of the artifact named by path. It repeats the entry in files so that a client reading only the head of the manifest still has the value it must check.
   */
  sha512: string;
  /**
   * When the release was published, in UTC. It is shown to the user and is never used to decide whether to update: that decision rests on the version alone, because a clock is not evidence.
   */
  releaseDate: string;
  /**
   * Optional. Shown with the restart prompt when present.
   */
  releaseNotes?: string;
  /**
   * Optional. The share of clients that should take this release. A client outside the share behaves exactly as it does when no update is offered.
   */
  stagingPercentage?: number;
  /**
   * Optional in 1.1.0 for compatibility with clients written against 1.0.0, which read a feed that carried Windows alone. When present it states the operating system this manifest is for, and a client that finds a value other than its own treats the feed as offering nothing rather than installing across platforms. Absent means the Windows feed, which is what 1.0.0 meant.
   */
  os?: "win32" | "darwin";
  /**
   * Optional, and meaningful only alongside os. The processor architecture this manifest is for. Separate manifests per architecture are what let a release be published for one architecture without offering it to the other; a package combining architectures is a manual download and is never named here.
   */
  arch?: "x64" | "arm64";
  [k: string]: unknown;
}


export const UPDATE_FEED_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://desktop-assistant.local/schemas/backend/update-feed/1.1.0.json",
  "title": "UpdateManifest",
  "description": "Shape of the update manifest published beside a release and read by the client updater, for backend/contracts/update-feed@1.1.0. One manifest describes one release for one operating system and one processor architecture; the client reads the manifest belonging to the machine it runs on, so the file never has to describe a package the reader cannot install. The manifest is served as YAML and unauthenticated, which it can afford to be only because nothing in it is trusted on its own: the digest below is checked against the downloaded bytes and the downloaded package is checked against the operating system's trust provider before anything is installed. What the file cannot express is exactly that chain, nor that a package signed with an identity other than the installed application's is refused rather than installed (spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q4; spikes/SP-11-secure-storage/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q3), which is why a manifest this file accepts can still be refused after download. Unknown members are admitted on purpose: adding optional metadata is a MINOR change, and an older client ignoring a member it does not know is how that stays true.",
  "type": "object",
  "required": [
    "version",
    "files",
    "path",
    "sha512",
    "releaseDate"
  ],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$",
      "description": "The version being offered. The client compares it against its own and treats anything not greater as no update, so a feed rolled back to an earlier version offers nothing rather than downgrading."
    },
    "files": {
      "type": "array",
      "minItems": 1,
      "description": "The artifacts of this release. A manifest declaring none is malformed rather than empty: there would be nothing to verify and nothing to install.",
      "items": {
        "type": "object",
        "required": [
          "url",
          "sha512",
          "size"
        ],
        "properties": {
          "url": {
            "type": "string",
            "description": "The artifact's name, resolved against the feed's own location. It is a name rather than an absolute address so that moving the release to another origin is a PATCH change. On macOS the installable artifact is the archive rather than the disk image, because the macOS updater installs from an archive; the disk image is published for manual download and is not named by path."
          },
          "sha512": {
            "type": "string",
            "pattern": "^[A-Za-z0-9+/]+={0,2}$",
            "description": "Base64 SHA-512 digest of the artifact. It is what a downloaded file is judged against; a mismatch deletes the cached file and fails the update rather than installing it."
          },
          "size": {
            "type": "integer",
            "minimum": 1,
            "description": "Artifact size in bytes, which is what lets the download be resumed by range and its progress be shown honestly."
          },
          "blockMapSize": {
            "type": "integer",
            "minimum": 1,
            "description": "Size of the companion block map when one is published. Present only for a differential download; its absence means the whole artifact is fetched."
          }
        }
      }
    },
    "path": {
      "type": "string",
      "description": "The artifact the client installs, named among the entries in files. It exists because a release may publish more than one artifact while only one of them is the installer for this platform."
    },
    "sha512": {
      "type": "string",
      "pattern": "^[A-Za-z0-9+/]+={0,2}$",
      "description": "Digest of the artifact named by path. It repeats the entry in files so that a client reading only the head of the manifest still has the value it must check."
    },
    "releaseDate": {
      "type": "string",
      "format": "date-time",
      "description": "When the release was published, in UTC. It is shown to the user and is never used to decide whether to update: that decision rests on the version alone, because a clock is not evidence."
    },
    "releaseNotes": {
      "type": "string",
      "description": "Optional. Shown with the restart prompt when present."
    },
    "stagingPercentage": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "description": "Optional. The share of clients that should take this release. A client outside the share behaves exactly as it does when no update is offered."
    },
    "os": {
      "type": "string",
      "enum": [
        "win32",
        "darwin"
      ],
      "description": "Optional in 1.1.0 for compatibility with clients written against 1.0.0, which read a feed that carried Windows alone. When present it states the operating system this manifest is for, and a client that finds a value other than its own treats the feed as offering nothing rather than installing across platforms. Absent means the Windows feed, which is what 1.0.0 meant."
    },
    "arch": {
      "type": "string",
      "enum": [
        "x64",
        "arm64"
      ],
      "description": "Optional, and meaningful only alongside os. The processor architecture this manifest is for. Separate manifests per architecture are what let a release be published for one architecture without offering it to the other; a package combining architectures is a manual download and is never named here."
    }
  }
} as const;
