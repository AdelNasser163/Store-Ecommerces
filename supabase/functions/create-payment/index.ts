// No card/ValU integration exists. Do not collect card data or fabricate charges.
Deno.serve(()=>new Response('Online payments are not configured. Use COD.',{status:503}));
