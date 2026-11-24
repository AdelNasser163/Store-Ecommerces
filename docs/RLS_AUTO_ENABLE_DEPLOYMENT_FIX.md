# Verified platform RLS event trigger exception — 2026-11-24

## Latest control-flow clarification

The former ELSIF belonged to `IF candidate_oid IS NOT NULL`, not to the inner
trigger-validation IF. It therefore did not execute after a valid configuration.
Nevertheless, the nesting obscured the rule and allowed the platform routine and
trigger to be absent together. The generator now uses sequential fail-closed
checks: reject a missing candidate, verify the exact function, verify the trigger
and attachment count, then authorize only that verified OID. No ELSIF remains.

The regenerated deployment passed **187/187 checks on isolated PostgreSQL 17.12**,
including the previous 185 checks plus rejection of both missing objects and a
missing zero-argument function while a trigger remains. The exact tested SQL
SHA256 is `3f84c25c4cca4d832e00abbcb0879d2224f7a4619bda08dd23e44bf39e63f15d`.
Function fingerprint, owner, language, SECURITY DEFINER, search_path, zero-argument
and event-trigger checks are unchanged. Generated SQL contains no mutation of the
existing platform function or trigger. Earlier counts/hashes below are historical.

No production connection, SQL execution on production, migration application,
Supabase setting change, deletion, Git staging, commit or push was performed.
No migration source was modified for this correction. Existing migration edits
from the preceding task remain separate working-tree changes.

## Root cause and corrected predicate

The first-install guard refused every non-extension routine in public/support_private.
MyStore's platform-managed public.rls_auto_enable() is not an extension member, so
the broad check rejected it despite its role in enabling RLS on new tables.

`tools/build-first-supabase-deploy.cjs` now validates this one routine before the
unknown-routine scan and excludes only its verified OID. It never excludes a name
wildcard or any overload. The generated `supabase/DEPLOY_TO_SUPABASE.sql` contains
the identical predicate. No CREATE/ALTER/DROP FUNCTION or CREATE/ALTER/DROP EVENT
TRIGGER for these production platform objects is included in the deployment.

Acceptance requires ALL of:

- namespace public; name rls_auto_enable; ordinary function; zero input/default/
  variadic arguments and no output argument list; scalar event_trigger return.
- owner postgres; language plpgsql; SECURITY DEFINER; exact single configuration
  `search_path=pg_catalog` (extra settings are rejected).
- `md5(pg_catalog.pg_get_functiondef(oid))` equals
  `846ec2fbff751d24b890656d63c3a9bf` with no whitespace normalization.
- event trigger ensure_rls belongs to postgres, references that exact function
  OID, event ddl_command_end, mode O, and exactly CREATE TABLE / CREATE TABLE AS /
  SELECT INTO command tags. No additional event trigger may attach to this OID.

If no zero-argument routine exists, deployment is refused even if no trigger
exists. A missing/misdirected ensure_rls is always refused. Any
unrecognized public/support_private routine remains rejected under the original
rules; extension-member platform functions retain their preexisting treatment.

## Fingerprint provenance, actually checked locally

The verified pre-deployment archive outside Git contains the actual routine and
event trigger definitions. Only their schema definitions were read as text with
pg_restore; no archive was restored and no customer records were extracted.
The routine and event trigger were recreated in a fresh PostgreSQL 17.12 test
cluster to compare the two candidate algorithms:

```text
MD5(pg_get_functiondef(oid)) = 846ec2fbff751d24b890656d63c3a9bf
MD5(prosrc)                 = c44fb229ea8a6b0afd04a0a33261c16c
```

Thus the supplied fingerprint is reproducibly the first expression. LF endings
are significant: a CRLF test copy produced different hashes. The exact trusted
fixture is in tests/postgres17/fixtures/rls-auto-enable.sql; .gitattributes pins
that fixture to LF. This fixture is for isolated tests ONLY, never production.

## Tests and outcomes

**Final result: 185/185 checks PASS on PostgreSQL 17.12**, including all previous
160 checks and 19 negative platform-guard mutation cases plus six provenance and
preservation/acceptance checks. Production contacted: false. Tested deployment
SHA256: `ccd2fc59bf36beb41c3d434c682f99fd160fa60eb5eb43a90f7befbb2f7acf9a`.
Source/PLpgSQL grammar, final permission invariants, encoding and diff whitespace
checks also passed. No migration source changed during this particular fix.

`tests/postgres17/tests.py` starts a NEW loopback-only PostgreSQL 17 cluster, accepts
no production DSN, and clears PostgreSQL connection environment variables. It
loads the trusted fixture, then calls the actual generated guard for acceptance
and rejection cases. Each negative mutation runs in a transaction that rolls back;
the harness refuses to count fixture construction errors as guard rejection.

Cases include changed body, wrong function/event owner, wrong language,
SECURITY INVOKER, wrong/extra search_path, extra function setting, absent trigger,
disabled/ALWAYS/REPLICA modes, changed event/tags/target function, extra event trigger,
extra unknown public/support_private routines and an argument-taking overload.

After negative cases, the original fingerprint/trigger are checked again. The
ENTIRE deployment then runs with the enabled platform trigger present, and its
definition/OID relationship/enabled state are checked afterward. Previous COD,
stock/idempotency/concurrency, Admin/Staff/Customer isolation, product privacy,
support archive, Storage RLS and publication checks remain in the same suite.

The latest actual outcome and named checks are in
`docs/backend-audit/postgres17-results.json`; no hosted Supabase Auth/Storage/
Realtime service result is implied. Initial hash probing with CRLF and one
invalid non-superuser trigger-owner fixture are diagnostic failures, not passes.

Regenerate with `node tools/build-first-supabase-deploy.cjs`, which generates text
only. Run source checks with `node tools/first-supabase-deploy-source.test.cjs`.
The local PostgreSQL command is documented in tests/postgres17/README.md. Do not
apply the generated file to MyStore until the owner separately approves it.
