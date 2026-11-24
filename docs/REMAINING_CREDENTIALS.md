# Remaining credentials and external APIs

No secret credentials were supplied, invented or embedded in frontend files.

| Integration | Required configuration | Current behavior |
| --- | --- | --- |
| Supabase staging | Auth/email callbacks, verified test users, schema installation and approved test project | Browser cloud flag remains disabled pending approval |
| Card provider | Selected provider/API version, merchant account, server API secret, webhook signing secret, documented signed payload protocol, EGP support, return URLs | Card disabled; create-payment/webhook return 503 |
| ValU | Merchant contract, API endpoints/version, server credentials, signed callback verification, amount/reference/idempotency rules | ValU disabled |
| Carrier | Chosen carrier API, server account/token, pickup/warehouse details, service codes, signed callback protocol, idempotency and tracking response contract | Fees configured; request state unconfigured; no fake tracking |
| Email/support | SMTP or transactional provider, verified sender/domain, server API credentials, delivery/error handling | Replies saved in conversation; no outbound email claim |
| Google OAuth | Real OAuth client/provider setup and allowed redirect URLs | Official SDK path exists; provider not configured/tested |

`SUPABASE_SERVICE_ROLE_KEY` is read only by server Edge Functions. Never send it
in chat, store it in Git or expose it through static files. Use the host's server
secret store. Provider implementations must be reviewed before enabling payment
settings; the current guard cannot be bypassed by checking a dashboard checkbox.

The generic server adapter contract has unit tests with explicit mock callbacks.
It does not implement any provider's cryptography, merchant API, refund or shipping
protocol. Those integrations cannot be declared working without real test accounts.
