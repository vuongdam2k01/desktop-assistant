import fs from 'node:fs';
import path from 'node:path';
import { Ajv } from 'ajv';
import {
  type AuthorisationProviderDescriptor,
  AUTHORISATION_PROVIDER_DESCRIPTOR_SCHEMA,
} from '@desktop-assistant/contracts/authorisation-provider-descriptor';
import { BackendError } from '../http/errors.js';
import type { SecretResolver } from '../secrets/environment-secret-resolver.js';

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, AuthorisationProviderDescriptor>();
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly validateDescriptor = this.ajv.compile(AUTHORISATION_PROVIDER_DESCRIPTOR_SCHEMA);

  constructor(
    private readonly descriptorDirectory: string,
    private readonly secretResolver: SecretResolver,
    private readonly logger?: {
      info: (obj: Record<string, unknown>, msg?: string) => void;
      warn: (obj: Record<string, unknown>, msg?: string) => void;
      error: (obj: Record<string, unknown>, msg?: string) => void;
    }
  ) {}

  async load(): Promise<void> {
    this.providers.clear();

    if (!fs.existsSync(this.descriptorDirectory)) {
      this.logger?.warn({ dir: this.descriptorDirectory }, 'Provider descriptor directory does not exist');
      return;
    }

    const files = fs.readdirSync(this.descriptorDirectory).filter(f => f.endsWith('.json'));
    const seenIds = new Set<string>();

    for (const file of files) {
      const fullPath = path.join(this.descriptorDirectory, file);
      let rawData: unknown;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        rawData = JSON.parse(content);
      } catch (err) {
        this.logger?.warn(
          { file, err: err instanceof Error ? err.message : String(err) },
          'Failed to parse provider descriptor JSON; withholding'
        );
        continue;
      }

      const isValid = this.validateDescriptor(rawData);
      if (!isValid) {
        this.logger?.warn(
          { file, errors: this.validateDescriptor.errors },
          'Provider descriptor failed schema validation; withholding'
        );
        continue;
      }

      const descriptor = rawData as AuthorisationProviderDescriptor;

      // Duplicate provider IDs fail startup
      if (seenIds.has(descriptor.providerId)) {
        throw new Error(
          `Duplicate providerId "${descriptor.providerId}" found in "${file}". Startup aborted.`
        );
      }
      seenIds.add(descriptor.providerId);

      // Check version support (only major version 0 is supported by 0.1.0 descriptor spec)
      const majorVersion = descriptor.version.split('.')[0];
      if (majorVersion !== '0') {
        this.logger?.warn(
          { providerId: descriptor.providerId, version: descriptor.version },
          'Unsupported major version; withholding provider'
        );
        descriptor.status = 'withheld';
      }

      // Check if secrets can be resolved
      const clientId = await this.secretResolver.resolveSecret(descriptor.clientIdRef);
      const clientSecret = await this.secretResolver.resolveSecret(descriptor.clientSecretRef);

      if (!clientId || !clientSecret) {
        this.logger?.warn(
          {
            providerId: descriptor.providerId,
            clientIdRef: descriptor.clientIdRef,
            clientSecretRef: descriptor.clientSecretRef,
            hasClientId: Boolean(clientId),
            hasClientSecret: Boolean(clientSecret),
          },
          'Missing client secrets for provider; withholding provider'
        );
        descriptor.status = 'withheld';
      } else if (!descriptor.status) {
        descriptor.status = 'offered';
      }

      this.logger?.info(
        {
          providerId: descriptor.providerId,
          name: descriptor.name,
          status: descriptor.status,
          clientIdRef: descriptor.clientIdRef,
          clientSecretRef: descriptor.clientSecretRef,
          tokenAuthMethod: descriptor.tokenAuthMethod,
          usesProofKey: descriptor.usesProofKey,
        },
        'Loaded provider descriptor'
      );

      this.providers.set(descriptor.providerId, descriptor);
    }
  }

  getProvider(providerId: string): AuthorisationProviderDescriptor {
    const provider = this.providers.get(providerId);
    if (!provider || provider.status === 'withheld') {
      throw new BackendError({
        statusCode: 404,
        code: 'PROVIDER_UNSUPPORTED',
        providerId,
        message: `Provider "${providerId}" is unsupported or withheld`,
      });
    }
    return provider;
  }

  hasProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    return Boolean(provider && provider.status === 'offered');
  }

  listOfferedProviders(): AuthorisationProviderDescriptor[] {
    return Array.from(this.providers.values()).filter(p => p.status === 'offered');
  }

  async resolveCredentials(provider: AuthorisationProviderDescriptor): Promise<ProviderCredentials> {
    const clientId = await this.secretResolver.resolveSecret(provider.clientIdRef);
    const clientSecret = await this.secretResolver.resolveSecret(provider.clientSecretRef);

    if (!clientId || !clientSecret) {
      throw new BackendError({
        statusCode: 404,
        code: 'PROVIDER_UNSUPPORTED',
        providerId: provider.providerId,
        message: `Credentials for provider "${provider.providerId}" are not configured`,
      });
    }

    return { clientId, clientSecret };
  }
}
