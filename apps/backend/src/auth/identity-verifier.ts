export interface IdentityPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export interface IdentityVerifier {
  verifyIdToken(idToken: string): Promise<IdentityPayload>;
}
