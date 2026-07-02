/* ══════════════════════════════════════
   ANASAYFA (LANDING) — Faz 3 / Parça 1
   Herkese açık tanıtım sayfası. İçerik varsayılan sabitlerden gelir;
   süper admin ileride S.landingConfig ile kodsuz düzenleyecek. */

const DEFAULT_LANDING = {
  heroTitle: 'Ekipman denetimini<br/><span>tek yerden</span> yönetin',
  heroSub: 'Yangın tüpü, jeneratör, kazan… tüm ekipmanlarınızın denetimini QR ile yapın, raporlayın, hatırlatma alın. Kağıt yok, karmaşa yok.',
  features: [
    { icon:'📱', title:'QR ile Denetim', desc:'Her ekipmana QR yapıştırın; okutun, denetimi anında açın. Saha personeli için pratik.' },
    { icon:'🔔', title:'Otomatik Hatırlatma', desc:'Denetim zamanı gelen ekipmanlar için uyarı alın. Hiçbir periyodik kontrolü kaçırmayın.' },
    { icon:'📊', title:'Raporlama & Analiz', desc:'Uygunluk oranları, arıza geçmişi, mahal bazlı risk analizi ve PDF çıktılar.' },
    { icon:'🏢', title:'Çoklu Şirket', desc:'Grup şirketleri için tek panelden tüm şirketleri yönetin, aralarında geçiş yapın.' },
    { icon:'📁', title:'Belge Arşivi', desc:'Sertifika, form, sözleşme… her belgeyi ekipmana bağlayın, klasörleyin, arayın.' },
    { icon:'🗂️', title:'İş Emri Takibi', desc:'Görev atayın, tamamlanınca onaylayın, revize isteyin. Tüm iş akışı kayıt altında.' },
  ],
  plans: [
    { id:'tekil', name:'Tekil Şirket', desc:'Tek işletme için ideal başlangıç.', price:'₺499', period:'/ay', old:'', featured:false,
      features:['1 şirket','10 kullanıcıya kadar','Sınırsız ekipman & denetim','Belge arşivi + iş emri','E-posta destek'], cta:'Başla' },
    { id:'grup', name:'Grup Şirket', desc:'Birden fazla işletmesi olanlar için.', price:'₺1.299', period:'/ay', old:'₺1.799', featured:true,
      features:['Sınırsız şirket','Sınırsız kullanıcı','Tüm Tekil özellikleri','Şirketler arası panel + karşılaştırma','Öncelikli destek'], cta:'Başla' },
    { id:'kurumsal', name:'Kurumsal', desc:'Özel ihtiyaçlar & entegrasyon.', price:'Teklif', period:'', old:'', featured:false,
      features:['Grup planının tümü','Özel eğitim & kurulum','Özel entegrasyonlar','SLA & hesap yöneticisi'], cta:'İletişime Geç' },
  ],
  contactNote: 'Sorularınız mı var? Size yardımcı olalım.',
};

function getLandingConfig(){
  const c = (S && S.landingConfig) ? S.landingConfig : {};
  return {
    heroTitle: c.heroTitle || DEFAULT_LANDING.heroTitle,
    heroSub:   c.heroSub   || DEFAULT_LANDING.heroSub,
    features:  (Array.isArray(c.features) && c.features.length) ? c.features : DEFAULT_LANDING.features,
    plans:     (Array.isArray(c.plans) && c.plans.length) ? c.plans : DEFAULT_LANDING.plans,
    contactNote: c.contactNote || DEFAULT_LANDING.contactNote,
  };
}

/* Ekran geçişleri */
function showLanding(){
  try{ document.getElementById('login-screen').style.display='none'; }catch(e){}
  try{ document.getElementById('app').style.display='none'; }catch(e){}
  try{ document.getElementById('companies-screen').style.display='none'; }catch(e){}
  const l=document.getElementById('landing-screen'); if(l) l.style.display='block';
  renderLanding();
  window.scrollTo(0,0);
}
function showLogin(){
  const l=document.getElementById('landing-screen'); if(l) l.style.display='none';
  const ls=document.getElementById('login-screen'); if(ls) ls.style.display='flex';
  try{ renderLoginContact(); }catch(e){}
  setTimeout(()=>{ const u=document.getElementById('login-user'); if(u) u.focus(); }, 60);
}
function lndScroll(id){
  const el=document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

function renderLanding(){
  const cfg=getLandingConfig();
  // Hero
  const ht=document.getElementById('lnd-hero-title'); if(ht) ht.innerHTML=cfg.heroTitle;
  const hs=document.getElementById('lnd-hero-sub'); if(hs) hs.textContent=cfg.heroSub;
  // Özellikler
  const fg=document.getElementById('lnd-feature-grid');
  if(fg) fg.innerHTML=cfg.features.map(f=>`
    <div class="lnd-card">
      <div class="lnd-card-ico">${f.icon||'⭐'}</div>
      <h3>${safe(f.title)}</h3>
      <p>${safe(f.desc)}</p>
    </div>`).join('');
  // Planlar
  const pl=document.getElementById('lnd-plans');
  if(pl) pl.innerHTML=cfg.plans.map(p=>`
    <div class="lnd-plan${p.featured?' featured':''}">
      ${p.featured?'<div class="lnd-plan-tag">★ En Popüler</div>':''}
      <h3>${safe(p.name)}</h3>
      <div class="lnd-plan-desc">${safe(p.desc)}</div>
      <div class="lnd-plan-price">${safe(p.price)}<small>${safe(p.period||'')}</small>${p.old?`<span class="lnd-plan-old">${safe(p.old)}</span>`:''}</div>
      <ul>${(p.features||[]).map(x=>`<li>${safe(x)}</li>`).join('')}</ul>
      <button class="btn ${p.featured?'btn-primary':'btn-secondary'}" onclick="startSignup('${p.id}')">${safe(p.cta||'Seç')}</button>
    </div>`).join('');
  // İletişim
  const cs=document.getElementById('lnd-contact-sub'); if(cs) cs.textContent=cfg.contactNote;
  const cb=document.getElementById('lnd-contact-box');
  if(cb){
    const ci=S.contactInfo||{};
    const tel=(ci.tel||'').trim(), mail=(ci.mail||CONTACT_EMAIL||'').trim();
    let h='';
    if(tel)  h+=`<a class="lnd-contact-row" href="tel:${safe(tel)}">📞 <span>${safe(tel)}</span></a>`;
    if(mail) h+=`<a class="lnd-contact-row" href="mailto:${safe(mail)}?subject=TakipEt%20Bilgi%20Talebi">✉️ <span>${safe(mail)}</span></a>`;
    h+=`<button class="lnd-contact-row" style="cursor:pointer;text-align:left;width:100%" onclick="showLogin()">🔑 <span>Zaten üye misiniz? Giriş yapın</span></button>`;
    cb.innerHTML=h;
  }
}

/* Plan seçimi — Parça 2'de gerçek kayıt akışına bağlanacak.
   Şimdilik kullanıcıyı bilgilendirir (sistem bozulmadan). */
function startSignup(planId){
  const cfg=getLandingConfig();
  const plan=(cfg.plans||[]).find(p=>p.id===planId);
  if(planId==='kurumsal'){ lndScroll('lnd-contact'); return; }
  const mail=(S.contactInfo?.mail||CONTACT_EMAIL||'').trim();
  const body=`<div style="padding:6px 2px">
    <div style="text-align:center;font-size:40px;margin-bottom:8px">🎉</div>
    <p style="font-size:15px;font-weight:700;color:var(--txt);text-align:center;margin-bottom:8px">${plan?safe(plan.name)+' planı':'Üyelik'} — çok yakında!</p>
    <p style="font-size:13.5px;color:var(--txt2);line-height:1.6;text-align:center;margin-bottom:18px">
      Online üye olma sistemi hazırlanıyor. Hemen başlamak isterseniz bizimle iletişime geçin, hesabınızı biz açalım.</p>
    ${mail?`<a class="btn btn-primary btn-full" style="text-decoration:none;margin-bottom:8px" href="mailto:${safe(mail)}?subject=${encodeURIComponent('TakipEt '+(plan?plan.name:'')+' Üyelik Talebi')}">✉️ Üyelik İçin Yaz</a>`:''}
    <button class="btn btn-secondary btn-full" onclick="closeModal('gmodal');showLogin()">Zaten üyeyim, giriş yap</button>
  </div>`;
  const gb=document.getElementById('gmodal-body');
  if(gb){ document.getElementById('gmodal-title').textContent='Üyelik'; gb.innerHTML=body; openModal('gmodal'); }
}
