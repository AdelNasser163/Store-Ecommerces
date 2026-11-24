// Integration point only. Future adapter must verify the caller with Auth.getUser,
// check user_roles server-side, read the authoritative order, lock/reuse the stored
// idempotency key and persist a real carrier response. Never accept client tracking.
Deno.serve(()=>new Response('Carrier API is not configured; shipping fees are configuration only.',{status:503}));
