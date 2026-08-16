# Keystone Threat Model

A plain description of what Keystone is built to defend against, how, and where the honest limits of the current version are. This is not a formal compliance document, it is a working engineer's account of the real decisions made while building a multi tenant auth service.

## What Keystone actually protects

Keystone sits in front of a multi tenant application's identity and permission data. If it fails, the failure mode is either someone getting access they should not have, or a tenant's data becoming visible to another tenant. Every decision below is made with one of those two failures in mind.

## Threat: a user tries to access another tenant's data

**The risk.** In any multi tenant system, the most damaging class of bug is a query that forgets to filter by tenant, silently leaking one company's users, roles, or data into another company's view.

**The defense.** Every table that holds tenant scoped data has Row Level Security enabled at the database level, not just checked in application code. This matters because it means even a bug in a route handler, a forgotten where clause, a copy paste mistake, still cannot leak data across tenants, because Postgres itself refuses the query. The permission check function also always takes a tenant id as an explicit argument and never infers it, so there is no code path where a check silently defaults to the wrong tenant.

**The honest limit.** RLS policies were added table by table as each feature was built, and in three separate cases during development, a table had RLS enabled but no actual grant or policy attached, which caused every query against it to fail outright rather than leak data. That is the safer failure mode, a hard error instead of silent leakage, but it also means the grants and policies need to be checked deliberately for any new table added later, since RLS being enabled does not by itself mean access is correctly scoped.

## Threat: brute force password guessing

**The risk.** An attacker with a list of email addresses tries many passwords against the login endpoint until one works.

**The defense.** The login route rate limits by email, allowing five failed attempts within a fifteen minute window before blocking further attempts, including attempts with the correct password, for fifteen minutes. This was tested directly, six consecutive failed logins were sent to the endpoint, and the sixth returned a block, and a subsequent attempt with the correct password during the block was also correctly rejected.

**The honest limit.** The rate limiter is in memory, not backed by a shared store like Redis. On a single server instance, which is what this project runs as, that is a real and complete defense. If Keystone were ever deployed across multiple server instances, an attacker could spread attempts across instances and the in memory counters would not see each other. The fix for that is a shared store, and naming that gap now is more honest than pretending the current version already scales past a single instance.

## Threat: a stolen or leaked session token being usable indefinitely

**The risk.** If a refresh token is ever exposed, an attacker who has it should not be able to use it forever, and the legitimate user should be able to kill that specific session without being logged out everywhere.

**The defense.** Refresh tokens are never stored in plain text. The sessions table stores a SHA-256 hash of the token, not the token itself, so even direct read access to the database does not hand over usable credentials. Each session also has its own expiry and can be individually revoked, which supports the specific case of log out this one device rather than only supporting a global sign out.

**The honest limit.** Revocation is not yet wired into a route, the schema and the hashing support it, but there is no endpoint yet that lets a user list their active sessions and revoke one. That is the next real feature this table is waiting for.

## Threat: a user granted no permission still being able to act

**The risk.** A route that checks whether someone is logged in, but not whether they are allowed to do the specific thing they are trying to do, is a common and serious class of bug.

**The defense.** The requirePermission middleware used on protected routes does two separate checks in order, first that the request carries a valid, current Supabase access token, and second that the specific user has the specific permission being asked for, checked fresh against the database every time rather than cached in the token. This was tested directly across all three outcomes, a request with no token at all is rejected before any permission logic runs, a request with a valid token for a permission the user does not have is denied, and a request with a valid token for a permission the user does have succeeds and returns real data.

**The honest limit.** Checking fresh on every request is a deliberate tradeoff for correctness over speed. If a role's permissions are changed, that change takes effect on the very next request, with no stale token to wait out. The cost is an extra database round trip on every protected call. For an identity service, where a permission change needs to be trustworthy the moment it happens, that tradeoff is the right one, but it is a real cost, not a free choice.

## Threat: weak authentication factors, phishing of passwords

**The risk.** Passwords can be phished, reused across sites, or guessed if they are weak, and that risk exists no matter how well the rest of the system is built.

**The defense.** Keystone supports WebAuthn as a real, working alternative to passwords, registration and login with a device backed passkey, verified cryptographically on the server using the credential's public key rather than a shared secret. This was tested end to end in a real browser, a passkey was registered using the device's own authenticator, and a subsequent login using that same passkey was cryptographically verified and produced a real session.

**The honest limit.** The current WebAuthn login path issues its own session record rather than a native Supabase Auth session, since Supabase Auth does not treat WebAuthn as a first class sign in method the way it does email and password. A production version of this would likely need a custom token issuance step to bring passkey logins fully in line with the password login path. That gap is named directly rather than glossed over.

## Threat: no record of what happened

**The risk.** If an account is compromised, or a permission is misused, and there is no record of when it happened or what was done, there is no way to investigate after the fact.

**The defense.** Every authentication event, successful logins, failed logins, rate limited attempts, and WebAuthn attempts, is written to an audit log with the user, tenant, event type, and whether it was allowed. This was confirmed directly in the database after testing, real rows exist for every one of those event types.

**The honest limit.** The audit log currently only captures authentication events. It does not yet log every permission check performed by requirePermission, only the entry and exit events around login. Logging every permission decision would make the audit trail more complete but also significantly larger, and that tradeoff has not been made yet.

## Threat: a cross origin request from an untrusted site

**The risk.** Once an API is meant to be called by external applications, as Keystone's login and permission check endpoints now are, it becomes reachable from any website's JavaScript unless explicitly restricted.

**The defense.** CORS headers were added to the login endpoint specifically to allow the mock client application, running on a separate port with no auth code of its own, to call Keystone directly and receive a real session. This was proven working, not just configured, a real login request was sent from a genuinely separate application and returned a valid, logged session.

**The honest limit.** The current CORS configuration allows any origin, Access-Control-Allow-Origin: *, which was the right choice for proving the mechanism works during development, but is not the right choice for a production deployment. A real version of Keystone would restrict this to an explicit list of trusted client domains, configured per tenant or per deployment, rather than left open to any site.

## Summary

Nothing in this document describes a finished, audited security product. It describes a set of real defenses, each one built for a specific threat, each one tested against its own success and failure case rather than assumed to work, and each one paired honestly with the limit of what it currently does not cover. The gaps named here, shared rate limiting across instances, session revocation endpoints, restricted CORS origins, and full permission check auditing, are the next real things to build, not hidden weaknesses being glossed over.

## Threat: a WebAuthn challenge disappearing between requests on serverless infrastructure

**The risk.** WebAuthn registration and login both work in two steps, first a challenge is generated and stored temporarily, then a second request verifies the signed response against that same stored challenge. If the two requests do not hit the same server process, the stored challenge is not there for the second request to check against.

**The defense.** This was actually observed directly during deployment to Vercel, not just anticipated. The first registration attempt against the live production URL failed with "no pending registration found," while a second attempt immediately after succeeded. The cause is that the challenge store is a plain in memory Map, and Vercel's serverless functions do not guarantee that two consecutive requests are handled by the same underlying process. The first request's challenge was stored on one instance, and the verify request landed on a different one.

**The honest limit.** This is the same category of tradeoff as the in memory rate limiter, acceptable and simple for a single, predictable environment, but a real gap once the deployment target is serverless infrastructure with multiple, short lived instances. The correct fix is the same as for rate limiting, move the challenge store out of application memory and into a shared store like Redis or a database table with a short expiry, so any instance handling the verify request can find the challenge regardless of which instance generated it. This was left as observed and documented rather than fixed immediately, since demonstrating the passkey flow working correctly on a retry was enough to prove the cryptographic verification itself is sound, and the storage layer is a clearly separable, well understood problem to solve next.
