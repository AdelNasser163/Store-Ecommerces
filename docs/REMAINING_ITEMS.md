# Remaining release items

- Existing MyStore: owner verifies backup and row counts. If orders/customers
  exist, explicit backup confirmation is required before migration. No database
  management connection was provided; use SUPABASE_SETUP_STEPS.md manually.
- Apply complete setup only after review. Current generated setup includes 011;
  145 real local PostgreSQL 16.11 checks passed. No production SQL executed.
- Create verified admin/staff/customer Auth accounts; configure URLs/SMTP and test
  real sessions, logout, expired sessions, role revocation and customer isolation.
- Storage HTTP upload/read and Realtime delivery require real service testing.
- Cloud config deliberately remains disabled. Resolve strict cart-only browser
  storage requirement before activation: legacy disabled-mode demo sources and
  wishlist/preferences/Auth persistence remain listed in DEPLOY_AUDIT.md. No
  existing local data was deleted and this requirement is not claimed complete.
- Rebuild after intentional cloud activation; publish matching HTML/dist files
  together. Current branch: feat/mystore-deploy-readiness. No force-push, merge,
  release or live verification performed. No workflow existed in this checkout;
  confirm Pages source in repository Settings → Pages (existing branch/folder or
  Actions) before introducing deployment automation.
- Publishing: push reviewed branch → open PR → review/merge → verify Pages source
  → wait for deployment → fetch live index/admin/catalog and key assets → prove
  real product read and authorized persisted write. Only then mark deployment
  passed. A working current public URL cannot prove this unreleased revision.
- Run MULTI_DEVICE_TEST.md; record real returned order ID and exact stock changes.
- Card/ValU stay disabled. No provider/carrier integration is required for COD;
  do not invent online payments, tracking numbers or shipment confirmations.
