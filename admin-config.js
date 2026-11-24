// Compatibility alias; centralized public connection values live in supabase-config.js.
window.AdminCloudConfig=Object.freeze({get mode(){return window.StoreBackendConfig?.enabled?'cloud':'local'},get url(){return window.StoreBackendConfig?.url||''},get publishableKey(){return window.StoreBackendConfig?.publishableKey||''},version:'2.1.0'});
