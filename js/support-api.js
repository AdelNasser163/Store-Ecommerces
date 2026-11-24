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

  const shared=window.StoreSupabase,sdk=shared?.client;
  let session=null;
  if(sdk){shared.session().then(value=>{session=value}).catch(()=>{});shared.subscribe(value=>{session=value.session})}
  const check=()=>{if(!shared?.enabled||!sdk||!shared.configured)throw Error('SETUP_REQUIRED')};
  window.AlMumezSupport={
    ready:!!(shared?.enabled&&shared.configured&&sdk),signedIn:()=>!!session?.access_token,
    async login(email,password){check();const {data,error}=await sdk.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;if(!await shared.rpc('is_support_admin')){await sdk.auth.signOut();throw Error('ADMIN_REQUIRED')}},
    async logout(){check();const {error}=await sdk.auth.signOut();if(error)throw error;session=null},
    async submit(data){check();const subject=data.subject;const {error}=await sdk.from('support_messages').insert({name:data.name.trim(),email:data.email.trim(),subject,message:data.message.trim(),consent:!!data.consent,order_number:['order','returns'].includes(subject)?data.orderNumber?.trim()||null:null,product_name:['product','returns'].includes(subject)?data.productName?.trim()||null:null});if(error)throw error},
    async list(filters={}){check();return shared.rpc('list_support_messages',filters)},
    async update(id,changes){check();const allowed=Object.fromEntries(['status','read_at','starred','archived'].filter(key=>key in changes).map(key=>[key,changes[key]]));const {data,error}=await sdk.from('support_messages').update(allowed).eq('id',id).select().single();if(error)throw error;return data}
  };
})();
