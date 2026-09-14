# Test signing certificates

Only the certificate requests (`*.cnf`) and the public certificates (`*.crt`) are kept here.
The private keys and the PKCS#12 bundles they were packaged into are not: this repository is
public, and a private key committed anywhere is a private key that has to be treated as
compromised, even one generated for a throwaway code-signing experiment.

Both are self-signed and carry no authority beyond this spike, so regenerating them costs
nothing. For each identity:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -config certA.cnf -keyout certA.key -out certA.crt
openssl pkcs12 -export -inkey certA.key -in certA.crt -out certA.p12 -passout pass:
```

The measurements recorded in this spike's report were taken against certificates generated
exactly this way; the subject names in the two configuration files are what distinguishes
identity A from identity B.
