# Keystone

A multi tenant authentication and authorization service, built to be infrastructure other applications depend on, not a login form bolted onto one app.

## The problem

Most portfolios show auth as a config choice. Add Supabase auth, add Firebase auth, done. That proves you can follow documentation. It does not prove you understand identity as a system, how sessions get issued and revoked, how permissions get checked and by whom, how a system behaves when someone tries to guess a password five hundred times in a row.

Keystone is an attempt to actually build that system, not describe it.

## What it does

Keystone handles signup, login, and permission checks for multiple separate tenants, each with their own roles and permissions, fully isolated from each other at the database level. A single Keystone deployment can serve many different applications, each with their own users, without any of them able to see another tenant's data.

It includes:

- Email and password authentication, with every failed and successful attempt logged
- Passwordless login using WebAuthn passkeys, tested end to end with a real device authenticator
- Rate limiting on login, tested by actually sending six failed attempts in a row and confirming the sixth gets blocked
- A permission check system that answers one specific question for every protected action, does this user have this permission in this tenant, checked fresh against the database every time rather than cached
- A full audit log of authentication events
- A separate demo application, keystone-client, that authenticates entirely by calling Keystone's API, proving Keystone works as real external infrastructure and not logic tied to one codebase

## How it is built

- Next.js and TypeScript, deployed on Vercel
- Supabase for the database, with Row Level Security enforced on every table from the first table created, not added later
- A schema built around real multi tenancy, tenants, roles, and permissions are all separate tables joined together, so a role at one company is a genuinely different row than a role at another, not a shared global list
- Refresh tokens are hashed before being stored, never kept in plain text
- WebAuthn handled through the SimpleWebAuthn library, verified cryptographically on the server

See THREAT_MODEL.md in this repo for a full account of what Keystone defends against, how each defense was tested, and where its current honest limits are.

## What actually happened during the build

Getting this working involved real debugging, not a straight line. A placeholder Supabase URL sat unnoticed in the environment file for longer than it should have, causing every request to fail with a generic error until it was traced back through the actual server logs. Table permissions had to be fixed three separate times as new tables were added, since enabling Row Level Security on a table does not by itself grant the access a query needs, a lesson learned the hard way each time rather than anticipated up front. WebAuthn's user verification setting needed to be relaxed twice, once for registration and once for login, after the first attempt at each was rejected by the verification library despite the passkey itself being created correctly.

None of that is hidden here because it is the actual story of building something that works, not the polished version of it.

## Status

The core service is fully working. Signup, login, permission checks, rate limiting, WebAuthn, and cross application authentication have all been tested directly, not just written and assumed correct.
