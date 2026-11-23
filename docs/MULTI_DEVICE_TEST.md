# Real COD acceptance — Requires my manual action

Not executed against MyStore. Use an explicitly approved real test purchase;
do not insert fake orders. Preserve resulting business records and avoid exposing
customer personal information in evidence.

1. Device A: open `admin.html`, sign in as verified admin; open `admin-orders.html`.
   This static project has no `/admin` route.
2. Device B: open the live storefront, record stock, add product, enter approved
   name/phone/address, choose COD. Card/ValU must not be available.
3. Confirm; record the SERVER-returned order number. Verify it on A via Realtime
   or refresh. Stock decreases exactly by ordered quantity. Refresh A, check a
   third browser, log out/in: the persisted order remains.
4. Double-click/retry the same attempt: exactly one order and one stock deduction.
   An uncertain response reuses requestId; changed payload with same ID rejects.
   Refreshing confirmation must not create another order; errors retain cart.
5. A: new → processing → shipping → completed; verify timeline. On a separately
   approved cancellable order, cancel before shipping and verify restoration once.
   Repeated cancellation never restores twice; cancellation after shipping rejects.
6. Table Editor: match order ID in orders, order_items, order_stock_reservations,
   inventory_transactions and customers. Record quantities before/after.
7. Verify customer A/B isolation, logged-out admin redirect, staff status updates
   and denied support deletion/restore/role assignment.
8. Submit a real contact request; verify persistence and anonymous read denial.
   Admin deletion creates a full deleted_support_messages archive; restore recovers
   the row, ownership and replies.

Evidence: date, exact live URL, devices, returned order ID, stock before/after,
dashboard/DB results. The production definition of done remains unmet until this
procedure actually passes.
