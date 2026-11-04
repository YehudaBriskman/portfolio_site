# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub:
[**Report a vulnerability**](https://github.com/YehudaBriskman/portfolio_site/security/advisories/new)
(the repository's **Security** tab, then **Report a vulnerability**). That
opens a private security advisory that only you and the maintainer can see.

Please include what you found, where (a URL or a file and line), how to
reproduce it, and what an attacker could do with it.

## What to expect

This is a personal project maintained by one person, so there is no formal
SLA. You can expect an acknowledgement within a few days, and a fix or a
mitigation as soon as is practical for anything that puts the live site or its
visitors at risk. You will be credited in the advisory unless you would rather
not be.

## Scope

In scope: this repository's code, and the site it deploys at
[yehudabriskman.com](https://yehudabriskman.com), including its API and its
remote MCP server.

Out of scope: denial-of-service and volume testing against the live site,
social engineering, and findings that need a compromised device or account to
begin with. Please test against a local copy (`make up`) where you can.

## Supported versions

Only what is currently deployed, which is the latest `v*` release tag, is
supported. Fixes land on `main` and ship in the next release.
