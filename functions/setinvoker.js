/* Tek seferlik yardımcı: Cloud Run servislerine çağrı izni (invoker) yazar.
   - login          → allUsers (callable protokolü; App Check/auth içeride)
   - dailymaintenance → Cloud Scheduler'ın kullandığı compute SA
   Kullanım: node setinvoker.js  (GOOGLE_APPLICATION_CREDENTIALS ayarlı olmalı) */
const { GoogleAuth } = require('google-auth-library');

const PROJECT = 'takip-et-app';
const REGION = 'europe-west1';
const COMPUTE_SA = 'serviceAccount:76177253474-compute@developer.gserviceaccount.com';

(async () => {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const jobs = [
    { svc: 'login', members: ['allUsers'] },
    { svc: 'dailymaintenance', members: [COMPUTE_SA] },
  ];
  for (const { svc, members } of jobs) {
    const base = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${svc}`;
    // Mevcut politikayı al, invoker binding'ini birleştir (üzerine yazma değil)
    let policy = { bindings: [] };
    try {
      const cur = await client.request({ url: `${base}:getIamPolicy` });
      if (cur.data && cur.data.bindings) policy = cur.data;
    } catch (e) { /* politika yoksa boş başla */ }
    let b = (policy.bindings || []).find(x => x.role === 'roles/run.invoker');
    if (!b) { b = { role: 'roles/run.invoker', members: [] }; policy.bindings = policy.bindings || []; policy.bindings.push(b); }
    for (const m of members) if (!b.members.includes(m)) b.members.push(m);
    const res = await client.request({ url: `${base}:setIamPolicy`, method: 'POST', data: { policy } });
    console.log(`${svc}: invoker OK →`, JSON.stringify(res.data.bindings));
  }
})().catch(e => { console.error('HATA:', (e.response && JSON.stringify(e.response.data)) || e.message); process.exit(1); });
