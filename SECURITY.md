# Security Policy

## Supported Versions

Aperture is pre-1.0. Security fixes are handled on the `main` branch until a
stable release branch policy is documented.

## Reporting A Vulnerability

Please do not open a public issue for a suspected vulnerability. Email
felix@elixr.games with:

- A concise description of the issue.
- Steps to reproduce or a proof of concept.
- Affected packages, versions, browsers, or platforms if known.
- Any suggested mitigation.

We will acknowledge reports as quickly as practical and coordinate disclosure
before publishing details.

## Scope

Security-sensitive areas include package publishing, generated project
scaffolding, CLI file operations, dev-server behavior, model/reference downloads,
and browser runtime code that handles untrusted assets.
