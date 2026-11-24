// Public credentials only. Never put a secret or service_role key here.
window.SupportConfig = Object.freeze({
  get mode(){return window.StoreBackendConfig?.enabled?'cloud':'demo'},
  get url(){return window.StoreBackendConfig?.url||''},
  get publishableKey(){return window.StoreBackendConfig?.publishableKey||''}
});
