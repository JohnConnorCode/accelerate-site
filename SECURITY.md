# Security policy

## Supported version

Security fixes are applied to the latest commit on `main`. This project does not currently maintain older release branches.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include customer data, credentials, exploit payloads, or provider responses in public logs.

Use GitHub private vulnerability reporting when it is available after the repository becomes public. Until then, email [john@acceleratewith.us](mailto:john@acceleratewith.us) with the subject `Accelerate security report`.

Please include:

- the affected route, component, or commit;
- the impact and required attacker access;
- minimal reproduction steps using fictional data;
- any suggested mitigation; and
- whether the issue is already public.

We aim to acknowledge reports within three business days and provide a status update within seven business days. Please allow a reasonable remediation window before disclosure.

## Scope priorities

Reports involving tenant isolation, authentication bypass, secret exposure, webhook replay, unsafe external actions, cross-tenant AI context, or customer-data access receive the highest priority.
