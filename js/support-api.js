(function () {
  'use strict';
  const config = window.SupportConfig || {}, base = (config.url || '').replace(/\/$/, ''), key = config.publishableKey || '';
  if(config.mode === 'demo') {
    const demoKey='almumez-support-demo-v1';
    const read=()=>{const data=JSON.parse(localStorage.getItem(demoKey)||'[]');if(!Array.isArray(data))throw new Error('DEMO_STORAGE_FAILED');return data;};
    const write=rows=>{localStorage.setItem(demoKey,JSON.stringify(rows));window.dispatchEvent(new Event('support:updated'));};
    window.AlMumezSupport={ready:true,demo:true,signedIn:()=>true,login:async()=>{},logout:async()=>{},
      async submit(data){const rows=read();rows.unshift({id:crypto.randomUUID(),name:data.name.trim(),email:data.email.trim(),subject:data.subject,message:data.message.trim(),consent:!!data.consent,order_number:['order','returns'].includes(data.subject)?data.orderNumber?.trim()||null:null,product_name:['product','returns'].includes(data.subject)?data.productName?.trim()||null:null,status:'new',read_at:null,created_at:new Date().toISOString()});write(rows);},
      async list({p_topic='',p_status='',p_query='',p_page=0}={}){const all=read(),query=p_query.toLowerCase(),rows=all.filter(r=>(!p_topic||r.subject===p_topic)&&(!p_status||r.status===p_status)&&[r.name,r.email,r.message,r.order_number,r.product_name].join(' ').toLowerCase().includes(query));return{rows:rows.slice(p_page*25,(p_page+1)*25),total:rows.length,unread:all.filter(r=>!r.read_at).length};},
      async update(id,changes){const rows=read(),row=rows.find(r=>r.id===id);if(!row)throw new Error('REQUEST_FAILED');if(changes.status){if(!['new','in_progress','resolved'].includes(changes.status))throw new Error('REQUEST_FAILED');row.status=changes.status;}if(changes.read_at)row.read_at=changes.read_at;write(rows);return row;}
    };return;
  }
  let unsafe = key.startsWith('sb_secret_');
  try { unsafe ||= JSON.parse(atob(key.split('.')[1])).role === 'service_role'; } catch {}
  const ready = /^https:\/\/[^/]+$/.test(base) && !!key && !unsafe;
  const storageKey = 'almumez-support-session:' + base;
  let session; try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch {}
  function save(value) { session = value; if(value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); }
  let refreshing;
  async function request(path, options = {}, authenticated = false, retry = true) {
    if (!ready) throw new Error('SETUP_REQUIRED');
    if (authenticated && !session?.access_token) throw new Error('LOGIN_REQUIRED');
    const response = await fetch(base + path, { ...options, cache: 'no-store', headers: { apikey: key, 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer ' + session.access_token } : {}), ...options.headers } });
    if(response.status === 401 && authenticated && retry && session?.refresh_token) {
      refreshing ||= request('/auth/v1/token?grant_type=refresh_token', {method:'POST', body:JSON.stringify({refresh_token:session.refresh_token})}).then(save).catch(error=>{save(null);throw error;}).finally(()=>{refreshing=null;});
      await refreshing; return request(path, options, true, false);
    }
    if(!response.ok) { if(authenticated && response.status===401)save(null); throw new Error(response.status === 401 ? 'LOGIN_REQUIRED' : 'REQUEST_FAILED'); }
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }
  window.AlMumezSupport = {
    ready, signedIn:()=>!!session?.access_token,
    async login(email,password) { save(await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})})); try { if(!await request('/rest/v1/rpc/is_support_admin',{method:'POST',body:'{}'},true))throw new Error('ADMIN_REQUIRED'); } catch(error){save(null);throw error;} },
    async logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'},true);}finally{save(null);}},
    async submit(data) {
      const subject=data.subject;
      const payload={name:data.name.trim(),email:data.email.trim(),subject,message:data.message.trim(),consent:!!data.consent,
        order_number:['order','returns'].includes(subject)?data.orderNumber?.trim()||null:null,
        product_name:['product','returns'].includes(subject)?data.productName?.trim()||null:null};
      await request('/rest/v1/support_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
    },
    list:filters=>request('/rest/v1/rpc/list_support_messages',{method:'POST',body:JSON.stringify(filters)},true),
    async update(id, changes) { const rows=await request('/rest/v1/support_messages?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)},true);if(!rows?.length)throw new Error('REQUEST_FAILED');return rows[0]; }
  };
})();
