# Spike signing certificate

Only the public certificate (`sp16-code-signing.cer`) and its metadata are kept here. The
PKCS#12 bundle held the matching private key and its password sat beside it in
`cert-info.json`; neither belongs in a public repository, even for a self-signed certificate
that signs nothing outside this spike.

Regenerate the bundle on Windows when reproducing the measurements:

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=Desktop Assistant (Spike SP-16 Code Signing)" `
  -CertStoreLocation Cert:\CurrentUser\My
$pwd = Read-Host -AsSecureString "Bundle password"
Export-PfxCertificate -Cert $cert -FilePath sp16-code-signing.pfx -Password $pwd
```

The report's findings concern how the operating system treats a signature whose certificate is
untrusted, so any self-signed code-signing certificate reproduces them; the subject name above
is the one the recorded runs used.
