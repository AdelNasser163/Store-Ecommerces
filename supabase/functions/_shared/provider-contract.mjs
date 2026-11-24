/* Server-only boundary. A provider adapter must verify the original raw bytes. */
export async function processPaymentWebhook(request,{adapter,settle,now=Date.now}){
 if(!adapter)return new Response('Payment provider is not configured',{status:503});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const length=Number(request.headers.get('content-length')||0);if(length>1024*1024)return new Response('Payload too large',{status:413});
 const raw=await request.text();if(raw.length>1024*1024)return new Response('Payload too large',{status:413});
 let event;try{event=await adapter.verifyAndDecode(raw,request.headers)}catch{return new Response('Invalid provider signature',{status:401})}
 if(!event||!event.id||!event.providerId||!['paid','failed','cancelled'].includes(event.status)||!Number.isFinite(event.amount)||event.amount<0||event.currency!=='EGP'||!Number.isFinite(event.signedAt)||Math.abs(now()-event.signedAt)>300000)return new Response('Invalid provider event',{status:400});
 try{await settle({p_event_id:event.id,p_provider:adapter.name,p_provider_id:event.providerId,p_status:event.status,p_amount:event.amount,p_currency:event.currency});return new Response(null,{status:204})}catch{return new Response('Settlement rejected',{status:409})}
}

export async function requestCarrierShipment({adapter,order,idempotencyKey}){
 if(!adapter)return{state:'unconfigured',provider:null,provider_reference:null,tracking_number:null};
 if(!order||!idempotencyKey)throw Error('Authoritative order and idempotency key required');
 const response=await adapter.createShipment(order,idempotencyKey);
 if(!response||!response.providerReference)throw Error('Carrier did not confirm a shipment');
 return{state:'confirmed',provider:adapter.name,provider_reference:response.providerReference,tracking_number:response.trackingNumber||null};
}
