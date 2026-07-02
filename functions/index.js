/* ══════════════════════════════════════════════════════════════
   TakipEt Cloud Functions (FAZ 2 — backend)
   1) login        : Güvenli giriş — kullanıcıyı SUNUCUDA arar/doğrular,
                     özel token (custom token) üretir. İstemcinin tüm
                     şirketleri okumasına gerek kalmaz → tenant izolasyonu
                     kurallarla kilitlenebilir.
   2) dailyMaintenance : Her gece 03:05 (TR) — sistem + şirket yedekleri,
                     çöp kutusu kalıcı temizliği. Tarayıcı açık olmasa da çalışır.
   Bölge: europe-west1 (Realtime DB ile aynı). (rev2 — invoker izni için yeniden deploy)
══════════════════════════════════════════════════════════════ */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const crypto = require('crypto');

// serviceAccount: token imzalama (createCustomToken) için Token Creator rolü olan hesap
setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 5,
  serviceAccount: 'firebase-adminsdk-fbsvc@takip-et-app.iam.gserviceaccount.com',
});

admin.initializeApp({
  databaseURL: 'https://takip-et-app-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: 'takip-et-app.firebasestorage.app',
});

const TENANT_ROOT = 'takipet';
const MAX_BACKUPS = 5;
const TRASH_DAYS = 30;
const db = () => admin.database();

/* ── Şifre doğrulama — istemcideki formatların BİREBİR aynısı ── */
function sha256hex(text){
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
// Eski basit hash (istemcideki legacyHash ile aynı: djb2 varyantı)
function legacyHash(p){
  let h = 5381;
  for (const c of String(p)) { h = ((h << 5) + h) + c.charCodeAt(0) | 0; }
  return 'pw' + Math.abs(h).toString(36);
}
function verifyPassword(pass, user){
  if (user.pwSalt && user.pwHash) return sha256hex(user.pwSalt + '::' + pass) === user.pwHash;
  if (user.pwHash && !user.pwSalt) return legacyHash(pass) === user.pwHash;
  return false;
}
const toArr = v => !v ? [] : (Array.isArray(v) ? v : Object.values(v));
// Kullanıcı objesinden hassas alanları temizle (istemciye gidecek)
function sanitizeUser(u){
  const { pwHash, pwSalt, ...rest } = u;
  return rest;
}

/* ── Kaba kuvvet koruması (sunucu tarafı): 5 hata → 60 sn kilit ── */
async function checkLoginGuard(uname){
  const key = sha256hex('guard::' + uname.toLowerCase()).slice(0, 32);
  const ref = db().ref(`${TENANT_ROOT}/loginGuard/${key}`);
  const snap = await ref.once('value');
  const g = snap.exists() ? snap.val() : { fails: 0, until: 0 };
  if (g.until && Date.now() < g.until) {
    const sec = Math.ceil((g.until - Date.now()) / 1000);
    throw new HttpsError('resource-exhausted', `Çok fazla hatalı deneme. ${sec} saniye bekleyin.`);
  }
  return { ref, g };
}
async function recordFail(ref, g){
  g.fails = (g.fails || 0) + 1;
  if (g.fails >= 5) { g.until = Date.now() + 60000; g.fails = 0; }
  await ref.set(g);
}

/* ══ 1) GÜVENLİ GİRİŞ ══
   İstek: { username, password }
   Cevap: { token, user, companyId, isSuper }               */
exports.login = onCall({ enforceAppCheck: false }, async (req) => {
  const username = String(req.data?.username || '').trim();
  const password = String(req.data?.password || '');
  if (!username || !password) throw new HttpsError('invalid-argument', 'Kullanıcı adı ve şifre gerekli');

  const { ref: guardRef, g: guard } = await checkLoginGuard(username);

  // 1) Süper admin mi?
  const suSnap = await db().ref(`${TENANT_ROOT}/superadmin`).once('value');
  const su = suSnap.exists() ? suSnap.val() : null;
  if (su && su.username === username) {
    if (!verifyPassword(password, su)) { await recordFail(guardRef, guard); throw new HttpsError('unauthenticated', 'Kullanıcı adı veya şifre hatalı'); }
    await guardRef.set({ fails: 0, until: 0 });
    const token = await admin.auth().createCustomToken('u_super', { isSuper: true, cid: null, role: 'admin' });
    return { token, user: sanitizeUser(su), companyId: null, isSuper: true };
  }

  // 2) Normal kullanıcı: tüm şirketlerin SADECE users dalında ara (sunucu tarafı)
  const compSnap = await db().ref(`${TENANT_ROOT}/companies`).once('value');
  const companies = compSnap.exists() ? Object.values(compSnap.val()) : [];
  for (const c of companies) {
    if (!c || !c.id) continue;
    const uSnap = await db().ref(`${TENANT_ROOT}/data/${c.id}/users`).once('value');
    const users = toArr(uSnap.exists() ? uSnap.val() : []);
    const user = users.find(u => u && u.username === username);
    if (user) {
      if (!verifyPassword(password, user)) { await recordFail(guardRef, guard); throw new HttpsError('unauthenticated', 'Kullanıcı adı veya şifre hatalı'); }
      await guardRef.set({ fails: 0, until: 0 });
      const uid = `${c.id}__${user.id}`.slice(0, 128);
      const token = await admin.auth().createCustomToken(uid, { isSuper: false, cid: c.id, role: user.role || 'viewer' });
      return { token, user: sanitizeUser(user), companyId: c.id, isSuper: false };
    }
  }
  await recordFail(guardRef, guard);
  throw new HttpsError('unauthenticated', 'Kullanıcı adı veya şifre hatalı');
});

/* ══ 2) GECE BAKIMI — her gün 03:05 TR ══
   - Sistem yedeği (backups hariç tam kopya) → backups/system (son 5)
   - Her şirketin yedeği → backups/company/{cid} (son 5)
   - Çöp kutusu: 30 günden eski dosyaları Storage'dan kalıcı sil
   İstemcideki gün-anahtarı işaretleri de yazılır → istemci fallback'i
   aynı gün ikinci kez yedek almaz.                                   */
function trDayKey(){
  const now = new Date(Date.now() + 3 * 3600000); // UTC+3
  if (now.getUTCHours() < 3) now.setUTCDate(now.getUTCDate() - 1);
  return now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + String(now.getUTCDate()).padStart(2, '0');
}
function nowStrTR(){
  return new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
async function trimBackups(ref){
  const snap = await ref.once('value');
  if (!snap.exists()) return;
  const entries = [];
  snap.forEach(ch => { entries.push({ key: ch.key, ts: (ch.val() || {}).ts || 0 }); });
  entries.sort((a, b) => b.ts - a.ts);
  for (let i = MAX_BACKUPS; i < entries.length; i++) await ref.child(entries[i].key).remove();
}

exports.dailyMaintenance = onSchedule({ schedule: '5 3 * * *', timeZone: 'Europe/Istanbul' }, async () => {
  const dayKey = trDayKey();
  const at = nowStrTR();

  // ── Sistem yedeği ──
  const rootSnap = await db().ref(TENANT_ROOT).once('value');
  const full = rootSnap.exists() ? rootSnap.val() : {};
  const data = { ...full };
  delete data.backups; delete data.loginGuard; // şişirmeyecek dallar
  await db().ref(`${TENANT_ROOT}/backups/system`).push({ ts: Date.now(), at, data, by: 'cloud' });
  await trimBackups(db().ref(`${TENANT_ROOT}/backups/system`));
  await db().ref(`${TENANT_ROOT}/backups/_lastAutoDay`).set(dayKey);

  // ── Şirket yedekleri ──
  const companies = Object.values(full.companies || {});
  for (const c of companies) {
    if (!c || !c.id) continue;
    const cData = (full.data || {})[c.id];
    if (!cData) continue;
    await db().ref(`${TENANT_ROOT}/backups/company/${c.id}`).push({ ts: Date.now(), at, cid: c.id, data: cData, by: 'cloud' });
    await trimBackups(db().ref(`${TENANT_ROOT}/backups/company/${c.id}`));
    await db().ref(`${TENANT_ROOT}/backups/_lastAutoDayCompany/${c.id}`).set(dayKey);
  }

  // ── Çöp kutusu kalıcı temizlik (30 günden eski) ──
  const trash = full.trash || {};
  const cutoff = Date.now() - TRASH_DAYS * 86400000;
  const bucket = admin.storage().bucket();
  let purged = 0;
  for (const [key, v] of Object.entries(trash)) {
    if (key.startsWith('_') || !v) continue;
    if ((v.ts || 0) < cutoff) {
      try { if (v.path) await bucket.file(v.path).delete({ ignoreNotFound: true }); } catch (e) {}
      await db().ref(`${TENANT_ROOT}/trash/${key}`).remove();
      purged++;
    }
  }
  await db().ref(`${TENANT_ROOT}/trash/_lastPurgeDay`).set(dayKey);

  console.log(`[dailyMaintenance] ${dayKey} — sistem + ${companies.length} şirket yedeklendi, ${purged} çöp temizlendi`);
});
