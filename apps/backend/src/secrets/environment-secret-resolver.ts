export interface SecretResolver {
  resolveSecret(ref: string): Promise<string | undefined>;
}

export class EnvironmentSecretResolver implements SecretResolver {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

  async resolveSecret(ref: string): Promise<string | undefined> {
    if (!ref || typeof ref !== 'string') {
      return undefined;
    }
    const val = this.env[ref];
    return val !== undefined && val.length > 0 ? val : undefined;
  }
}
