export interface paths {
    "/updates/{manifest}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the manifest describing the most recent release for one operating system and architecture.
         * @description Served as YAML with no authentication and no cryptographic signature of its own. The client reads the manifest belonging to the machine it runs on; a client written against 1.0.0 reads `latest.yml` and continues to receive the Windows feed, which is what that name meant. The shape of the manifest is update-feed.schema.json, and its integrity is established by what follows it rather than by how it arrived.
         */
        get: operations["getLatestManifest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/updates/{filename}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fetch a release artifact named by the manifest.
         * @description Returns the package or its block map as a byte stream. The name comes from the manifest rather than from anything the client composes, so this path exposes only what a published manifest already names.
         */
        get: operations["getReleaseArtifact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * UpdateManifest
         * @description Shape of the update manifest published beside a release and read by the client updater, for backend/contracts/update-feed@1.1.0. One manifest describes one release for one operating system and one processor architecture; the client reads the manifest belonging to the machine it runs on, so the file never has to describe a package the reader cannot install. The manifest is served as YAML and unauthenticated, which it can afford to be only because nothing in it is trusted on its own: the digest below is checked against the downloaded bytes and the downloaded package is checked against the operating system's trust provider before anything is installed. What the file cannot express is exactly that chain, nor that a package signed with an identity other than the installed application's is refused rather than installed (spikes/SP-16-signing-update/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q4; spikes/SP-11-secure-storage/macos/REPORT.md#1-tra-loi-tung-cau-hoi Q3), which is why a manifest this file accepts can still be refused after download. Unknown members are admitted on purpose: adding optional metadata is a MINOR change, and an older client ignoring a member it does not know is how that stays true.
         */
        "update-feed.schema": {
            /** @description The version being offered. The client compares it against its own and treats anything not greater as no update, so a feed rolled back to an earlier version offers nothing rather than downgrading. */
            version: string;
            /** @description The artifacts of this release. A manifest declaring none is malformed rather than empty: there would be nothing to verify and nothing to install. */
            files: {
                /** @description The artifact's name, resolved against the feed's own location. It is a name rather than an absolute address so that moving the release to another origin is a PATCH change. On macOS the installable artifact is the archive rather than the disk image, because the macOS updater installs from an archive; the disk image is published for manual download and is not named by path. */
                url: string;
                /** @description Base64 SHA-512 digest of the artifact. It is what a downloaded file is judged against; a mismatch deletes the cached file and fails the update rather than installing it. */
                sha512: string;
                /** @description Artifact size in bytes, which is what lets the download be resumed by range and its progress be shown honestly. */
                size: number;
                /** @description Size of the companion block map when one is published. Present only for a differential download; its absence means the whole artifact is fetched. */
                blockMapSize?: number;
            }[];
            /** @description The artifact the client installs, named among the entries in files. It exists because a release may publish more than one artifact while only one of them is the installer for this platform. */
            path: string;
            /** @description Digest of the artifact named by path. It repeats the entry in files so that a client reading only the head of the manifest still has the value it must check. */
            sha512: string;
            /**
             * Format: date-time
             * @description When the release was published, in UTC. It is shown to the user and is never used to decide whether to update: that decision rests on the version alone, because a clock is not evidence.
             */
            releaseDate: string;
            /** @description Optional. Shown with the restart prompt when present. */
            releaseNotes?: string;
            /** @description Optional. The share of clients that should take this release. A client outside the share behaves exactly as it does when no update is offered. */
            stagingPercentage?: number;
            /**
             * @description Optional in 1.1.0 for compatibility with clients written against 1.0.0, which read a feed that carried Windows alone. When present it states the operating system this manifest is for, and a client that finds a value other than its own treats the feed as offering nothing rather than installing across platforms. Absent means the Windows feed, which is what 1.0.0 meant.
             * @enum {string}
             */
            os?: "win32" | "darwin";
            /**
             * @description Optional, and meaningful only alongside os. The processor architecture this manifest is for. Separate manifests per architecture are what let a release be published for one architecture without offering it to the other; a package combining architectures is a manual download and is never named here.
             * @enum {string}
             */
            arch?: "x64" | "arm64";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getLatestManifest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The manifest name for the operating system and architecture of the reader — `latest.yml` for Windows, `latest-mac.yml` for macOS, with the architecture carried inside the document. The set of names is closed: a name outside it is a 404 rather than a search. */
                manifest: "latest.yml" | "latest-mac.yml";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The manifest for the current release on that operating system. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/yaml": components["schemas"]["update-feed.schema"];
                };
            };
            /** @description No manifest is published for that operating system. The client treats this as no update available and says nothing to the user, because a platform that has published nothing yet is not a failure. This is also what a release published for one operating system alone looks like to the other. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The origin failed. The check is abandoned until the next one; a failed check never interrupts work and never reports an update the client could not read. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getReleaseArtifact: {
        parameters: {
            query?: never;
            header?: {
                /** @description Byte range, written as "bytes=0-1048575". Support is required: it is what lets an interrupted download resume and what lets a differential download fetch only the blocks that changed. */
                Range?: string;
            };
            path: {
                /** @description The artifact name, exactly as the manifest carries it. */
                filename: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The whole artifact. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            /** @description The requested byte range of the artifact. */
            206: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                };
            };
            /** @description No such artifact. The update fails cleanly and the partially downloaded file, if any, is deleted rather than kept for a later attempt against a manifest that may have moved on. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The requested range lies outside the artifact. The client restarts the download from the beginning rather than assembling a file from ranges it could not verify. */
            416: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}


export const UPDATE_FEED_OPENAPI = {
  "openapi": "3.1.0",
  "info": {
    "title": "Update Feed",
    "version": "1.1.0",
    "description": "The static, unauthenticated HTTP surface a released application reads to learn whether a newer version exists and to fetch it. It is deliberately the dumbest surface in the product: two reads, no session, no identity, nothing the server decides. Version 1.1.0 widens the key of the feed from one dimension to two, so that a manifest describes one release for one operating system and one processor architecture rather than one release outright — a client is then never offered a package its own updater cannot apply. Trust is still established on the device, by checking the downloaded bytes against the digest in the manifest and the downloaded package against the trust provider of the operating system, with the added condition on macOS that a package whose signing identity differs from that of the installed application is refused rather than installed. Range support is required rather than optional, because a partially downloaded package that cannot be resumed is downloaded again from the start on a connection that already failed once."
  },
  "servers": [
    {
      "url": "https://updates.example.invalid",
      "description": "Placeholder. The origin is configuration, and moving the release to another origin or content distribution network is a PATCH change to this contract, because nothing here depends on which host answers."
    }
  ],
  "paths": {
    "/updates/{manifest}": {
      "get": {
        "operationId": "getLatestManifest",
        "summary": "Read the manifest describing the most recent release for one operating system and architecture.",
        "description": "Served as YAML with no authentication and no cryptographic signature of its own. The client reads the manifest belonging to the machine it runs on; a client written against 1.0.0 reads `latest.yml` and continues to receive the Windows feed, which is what that name meant. The shape of the manifest is update-feed.schema.json, and its integrity is established by what follows it rather than by how it arrived.",
        "parameters": [
          {
            "name": "manifest",
            "in": "path",
            "required": true,
            "description": "The manifest name for the operating system and architecture of the reader — `latest.yml` for Windows, `latest-mac.yml` for macOS, with the architecture carried inside the document. The set of names is closed: a name outside it is a 404 rather than a search.",
            "schema": {
              "type": "string",
              "enum": [
                "latest.yml",
                "latest-mac.yml"
              ]
            }
          }
        ],
        "responses": {
          "200": {
            "description": "The manifest for the current release on that operating system.",
            "content": {
              "text/yaml": {
                "schema": {
                  "$ref": "./update-feed.schema.json"
                }
              }
            }
          },
          "404": {
            "description": "No manifest is published for that operating system. The client treats this as no update available and says nothing to the user, because a platform that has published nothing yet is not a failure. This is also what a release published for one operating system alone looks like to the other."
          },
          "500": {
            "description": "The origin failed. The check is abandoned until the next one; a failed check never interrupts work and never reports an update the client could not read."
          }
        }
      }
    },
    "/updates/{filename}": {
      "get": {
        "operationId": "getReleaseArtifact",
        "summary": "Fetch a release artifact named by the manifest.",
        "description": "Returns the package or its block map as a byte stream. The name comes from the manifest rather than from anything the client composes, so this path exposes only what a published manifest already names.",
        "parameters": [
          {
            "name": "filename",
            "in": "path",
            "required": true,
            "description": "The artifact name, exactly as the manifest carries it.",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "Range",
            "in": "header",
            "required": false,
            "description": "Byte range, written as \"bytes=0-1048575\". Support is required: it is what lets an interrupted download resume and what lets a differential download fetch only the blocks that changed.",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "The whole artifact.",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          },
          "206": {
            "description": "The requested byte range of the artifact.",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          },
          "404": {
            "description": "No such artifact. The update fails cleanly and the partially downloaded file, if any, is deleted rather than kept for a later attempt against a manifest that may have moved on."
          },
          "416": {
            "description": "The requested range lies outside the artifact. The client restarts the download from the beginning rather than assembling a file from ranges it could not verify."
          }
        }
      }
    }
  }
} as const;
