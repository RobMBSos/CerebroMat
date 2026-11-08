# Smallstep JOSE compatibility patch

`certificates-jose-v4.patch` is the runtime and provisioner-test portion of upstream commit `cddde30af36e238f156bb557bfd1f11a05ffe6f9` from https://github.com/smallstep/certificates. It applies to the tagged v0.30.2 source and adapts it to `go.step.sm/crypto` v0.92.0 and go-jose v4.1.9. It preserves the audience validation semantics while replacing the deprecated JOSE v3 dependency.

The Caddy build runs the AWS, Azure and OIDC provisioner tests before compiling. Remove this patch and local module replacement once a compatible tagged Smallstep certificates release includes that upstream migration.
