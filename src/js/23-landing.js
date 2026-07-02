/* ══════════════════════════════════════
   ANASAYFA (LANDING) — Faz 3 / Parça 1
   Herkese açık tanıtım sayfası. İçerik varsayılan sabitlerden gelir;
   süper admin ileride S.landingConfig ile kodsuz düzenleyecek. */

const DEFAULT_LANDING = {
  heroTitle: 'İşletmenizin teknik yönetimini<br/><span>tek yerden</span> yapın',
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
    { id:'tekil', name:'Tekil Şirket', desc:'Tek işletme için ideal başlangıç.', price:'—', period:'', old:'', featured:false,
      features:['1 şirket','10 kullanıcıya kadar','Sınırsız ekipman & denetim','Belge arşivi + iş emri','E-posta destek'], cta:'Başla' },
    { id:'grup', name:'Grup Şirket', desc:'Birden fazla işletmesi olanlar için.', price:'—', period:'', old:'', featured:true,
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

/* ══ ÜYE OL AKIŞI (Parça 2) — plan seç → form → sunucu hesabı açar → otomatik giriş ══ */
function startSignup(planId){
  if(planId==='kurumsal'){ lndScroll('lnd-contact'); return; }
  openSignupModal(planId);
}

function openSignupModal(planId){
  const cfg=getLandingConfig();
  const plan=(cfg.plans||[]).find(p=>p.id===planId)||{name:planId};
  const gb=document.getElementById('gmodal-body'); if(!gb) return;
  document.getElementById('gmodal-title').textContent='🚀 Üye Ol — '+(plan.name||'');
  gb.innerHTML=`
    ${planId==='grup'?`<p style="font-size:12.5px;color:var(--txt2);line-height:1.5;background:var(--bg2);border-radius:10px;padding:10px 12px;margin-bottom:14px">Grup üyeliğinde ilk şirketinizle başlarsınız; çoklu şirket paneli hesabınıza eklenecek.</p>`:''}
    <div class="form-group"><label class="form-label">FİRMA / İŞLETME ADI</label>
      <input class="form-input" id="su-company" placeholder="örn: Miray Otel" autocomplete="organization"/></div>
    <div class="form-group"><label class="form-label">AD SOYAD</label>
      <input class="form-input" id="su-fullname" placeholder="örn: Can Konuralp" autocomplete="name"/></div>
    <div class="form-group"><label class="form-label">E-POSTA</label>
      <input class="form-input" id="su-email" type="email" placeholder="ornek@firma.com" autocomplete="email"/></div>
    <div class="form-group"><label class="form-label">KULLANICI ADI</label>
      <input class="form-input" id="su-username" placeholder="giriş için kullanacaksınız" autocomplete="username"/></div>
    <div class="form-group"><label class="form-label">ŞİFRE</label>
      <div class="pw-wrap"><input class="form-input" id="su-pass" type="password" placeholder="En az 8 karakter, harf+rakam" autocomplete="new-password"/><button type="button" class="pw-toggle" data-pw="su-pass" aria-label="Şifreyi göster"></button></div></div>
    <div class="form-group"><label class="form-label">ŞİFRE (TEKRAR)</label>
      <input class="form-input" id="su-pass2" type="password" autocomplete="new-password"/></div>
    <p class="login-error" id="su-error" style="display:none"></p>
    <button class="btn btn-primary btn-full" id="su-submit" onclick="doSignup('${planId}')" style="margin-top:6px">✅ Hesabımı Oluştur</button>
    <p style="font-size:11.5px;color:var(--txt3);text-align:center;margin-top:10px">Hesabınız anında açılır, panele otomatik girersiniz.</p>`;
  // Göz ikonunu statik giriş ekranındakinden kopyala (delegation tıklamayı zaten yakalar)
  const srcT=document.querySelector('.pw-toggle[data-pw="login-pass"]');
  if(srcT) gb.querySelectorAll('.pw-toggle').forEach(b=>{ b.innerHTML=srcT.innerHTML; });
  openModal('gmodal');
  setTimeout(()=>{ document.getElementById('su-company')?.focus(); }, 80);
}

function suError(msg){
  const el=document.getElementById('su-error');
  if(el){ el.textContent=msg; el.style.display='block'; el.classList.add('show'); }
}

async function doSignup(planId){
  const val=id=>(document.getElementById(id)?.value||'').trim();
  const companyName=val('su-company'), fullname=val('su-fullname'), email=val('su-email'), username=val('su-username');
  const pass=document.getElementById('su-pass')?.value||'';
  const pass2=document.getElementById('su-pass2')?.value||'';
  const err=document.getElementById('su-error'); if(err) err.style.display='none';
  // Yerel ön kontroller (sunucu yine de doğrular)
  if(companyName.length<2) return suError('Firma adı en az 2 karakter olmalı');
  if(fullname.length<2) return suError('Ad soyad girin');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return suError('Geçerli bir e-posta adresi girin');
  if(!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) return suError('Kullanıcı adı 3-30 karakter olmalı (harf, rakam, . _ -)');
  const pwErr=checkPasswordStrength(pass); if(pwErr) return suError(pwErr);
  if(pass!==pass2) return suError('Şifreler birbiriyle aynı değil');
  if(!_fns) return suError('Bağlantı hazır değil — sayfayı yenileyip tekrar deneyin');

  const btn=document.getElementById('su-submit');
  if(btn){ btn.disabled=true; btn.textContent='Hesabınız oluşturuluyor…'; }
  try{
    const res=await _fns.httpsCallable('signup')({ plan:planId, companyName, fullname, email, username, password:pass });
    const d=res&&res.data;
    if(!d||!d.token) throw new Error('Sunucudan geçersiz cevap');
    // Otomatik giriş — normal kullanıcı giriş akışının aynısı
    try{ await firebase.auth(firebase.app('takipet')).signInWithCustomToken(d.token); }catch(e){ console.warn('signup token:', e.message); }
    try{ attachCompaniesListener(); }catch(e){}
    S.cur=d.user; S.cur.companyId=d.companyId;
    setSession(S.cur);
    startSessionTimer();
    closeModal('gmodal');
    const l=document.getElementById('landing-screen'); if(l) l.style.display='none';
    document.getElementById('login-screen').style.display='none';
    showLoading(true);
    await bindCompanyData(d.companyId);
    await new Promise(r=>setTimeout(r,500));
    showLoading(false);
    bootApp();
    toast('🎉 Hoş geldiniz! Hesabınız hazır — ilk mahalinizi ekleyerek başlayın.', 6000);
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='✅ Hesabımı Oluştur'; }
    suError(e.message||'Kayıt başarısız — tekrar deneyin');
  }
}
