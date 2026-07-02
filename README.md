# TakipEt — Claude Code Devam Talimatı

Bu dosya, projeye Claude Code'da devam edecek olan asistan içindir. **İlk iş olarak bu dosyayı baştan sona oku.**

---

## 0. KULLANICIYA HİTAP (ÖNEMLİ)
- Kullanıcıya **"reisim"** diye hitap et. "koçum", "kanka", "dostum" DEME.
- Türkçe konuş.
- Kullanıcı canlı deploy edip ekran görüntüsüyle test eder, sonuçları bildirir, iterasyon yapar.
- "Kusursuz" çalışma bekler. UI'nin bozulmasını sevmez. Veri kaybına TAHAMMÜLÜ YOKTUR.
- Bir şeyi "yaptım, çalışıyor" deme — kanıtla (build çıktısında özelliğin var olduğunu grep ile göster).

---

## 1. PROJE NEDİR
**TakipEt** — Otel grubu için çok-şirketli (multi-tenant) ekipman denetim ve raporlama PWA'sı. Hedef: 100+ firmaya hizmet vermek.

- **Stack:** Vanilla JS (framework yok) + Firebase (Realtime DB, Storage, App Check, Anonymous Auth)
- **Deploy:** GitHub Pages → `cankonuralp.github.io/ekipman-takip/` (TEK index.html)
- **Mimari karar:** Şu an tek-dosya. Kullanıcı 100 firmaya çıkmadan **modüler mimariye (Vite vb.) geçmeyi** planlıyor — bu Claude Code'da yapılacak büyük iş olabilir (aşağıda "Gelecek" bölümü).

---

## 2. DOSYA YAPISI (git reposu = bu klasör, origin: cankonuralp/ekipman-takip)
```
takipet/                     ← git kökü (GitHub Pages bu kökten yayınlar)
├── index.html               ← BUILD ÇIKTISI — canlı site (deploy edilen tek dosya)
├── README.md                ← bu dosya
├── .gitignore
└── src/                     ← TÜM KAYNAK (Pages bunları sunmaz, sadece versiyonlar)
    ├── js/                  ← UYGULAMA KODU: 22 SIRALI modül (2026-07-02'de bölündü)
    │   ├── 01-config-sabitler-form-motoru.js
    │   ├── 02-state-yardimci.js
    │   ├── ...              (konu bazlı; build AD SIRASINA göre birleştirir)
    │   └── 22-modal-tema-events-baslat.js
    ├── style.css            (~1000 satır)
    ├── index.html           (şablon — script'siz, build inline eder)
    ├── qrcode-generator.js  (QR üretici kütüphane)
    ├── icons.json           (PNG ikonlar base64: apple, fav192, fav512, fav32)
    └── build.py             (BUILD SCRIPT — kök index.html üretir + otomatik node --check)
```
**ÖNEMLİ:** Eski `src/app.js` SİLİNDİ — kod artık `src/js/*.js` modüllerinde. Global scope
korunur (inline onclick'ler çalışsın diye ES modül KULLANILMAZ). Yeni modül eklerken sıra
numarası ver; tanımlar kullanımdan önce yüklenmeli.
**Neden böyle:** kök `index.html` (build çıktısı) ile `src/index.html` (şablon) aynı isimde —
çakışmasın diye kaynak `src/` altında. Kök index.html = canlı site; Pages kökten yayınlar.

---

## 3. BUILD & DEPLOY NASIL ÇALIŞIR (ZORUNLU YÖNTEM)
```bash
cd src
python build.py          # js/*.js (sıralı) + style.css + qrcode → KÖK index.html'e inline eder
                         # (her modülü + birleşik bütünü OTOMATİK node --check eder)
cd ..
git add -A && git commit -m "..." && git push   # GitHub Pages otomatik yayınlar
```
- `build.py`, `src/js/*.js` modüllerini ad sırasına göre birleştirir, `src/index.html` şablonunun body'sini alır, `<script>`leri siler, head'e Firebase SDK + QR CDN'lerini + base64 favicon/manifest ekler, sonuna qrcode-generator.js ve birleşik uygulama kodunu inline gömer; çıktıyı **repo kökü `index.html`**'e yazar.
- **Deploy:** `git push` → GitHub Pages kök `index.html`'i otomatik yayınlar (~1 dk). Ayrı kopyalama yok.
- Windows notu: yeni terminalde Python/Node PATH'te görünmezse PATH'i tazele (bkz. memory).
- **HER teslimde:** build (node --check otomatik) → kök index.html'de özelliğin VAR olduğunu grep ile teyit et → push → kullanıcıya hard-refresh hatırlat.

---

## 4. FIREBASE CONFIG (src/js/01-config-sabitler-form-motoru.js başında)
```
apiKey: 'AIzaSyCzNioHFZ2THtSDtp8JRBXYpLYQg1_X2zQ'
authDomain: 'takip-et-app.firebaseapp.com'
databaseURL: 'https://takip-et-app-default-rtdb.europe-west1.firebasedatabase.app'
projectId: 'takip-et-app'
storageBucket: 'takip-et-app.firebasestorage.app'
messagingSenderId: '76177253474'
appId: '1:76177253474:web:e3bfc281b31e1a1c949d3b'
APP_CHECK_KEY: '6LcLFC0tAAAAAIFzcIZlOfn5s06_P6gVsJyLYI7K'
```
- Süper admin kullanıcı adı: **`adminstatorack`**
- DB bölgesi: europe-west1 (Belçika) · Storage: us-central1

### Firebase Güvenlik Kuralları (KULLANICI TEYİT ETTİ — DEĞİŞTİRME)
**Realtime DB:**
```json
{"rules":{"takipet":{".read":"auth != null",".write":"auth != null"}}}
```
**Storage:** `belgeler/{allPaths=**}` altı auth!=null read/delete + write max 3MB (sadece pdf/image). Diğer her yer `if false` (kapalı).

---

## 5. VERİ YAPISI (Firebase Realtime DB)
```
takipet/
  companies/{id}              → şirket kataloğu (id, name, createdAt...)
  data/{şirketId}/            → İZOLE şirket verisi:
      users, mahals, equips, reports, logs, activity, notifications,
      customCats, catForms, catOverrides, rolePerms, contactInfo, companyFolders
  superadmin, superlogs       → süper admin global
  globalContact               → global iletişim (giriş ekranları)
  globalCats                  → global tür şablonu { overrides, forms, custom }
  globalDocs                  → genel evraklar (belge ağacı)
  errorLogs                   → HATA KAYITLARI (otomatik yakalanan JS hataları)
  backups/
    system/                   → tüm sistem yedekleri (son 5)
    company/{cid}/            → şirket yedekleri (son 5)
    _lastAutoDay              → son otomatik yedek günü (TR 03:00 mantığı)
Storage:
  belgeler/{şirketId}/{equipId}/...   → ekipman belgeleri (şirkete izole)
  belgeler/_global/{folderId}/...     → genel evraklar
  belgeler/{cid}/_folders/{fid}/...   → şirket manuel klasör belgeleri
```

### Önemli sabitler/fonksiyonlar (src/js/ modülleri)
- `TENANT_ROOT = 'takipet'`
- `companyDataPath(cid)` → `takipet/data/{cid}`
- `BASE_CATS` → 6 temel tür: kazan, jenerator, yangin-alg, tup-dolap, yangin-su, elektrik
- Ekipman `e.cat` kullanır (catId değil). `catById(id)` ile tür bilgisi.
- `inspectStatus(e)` → `{state: ok|soon|overdue|never|none, days, period}` (denetim durumu)
- `S` = global state objesi (S.companies, S.mahals, S.equips, S.reports, S.cur, S.activeCompanyId...)
- Roller: viewer(1) < inspector(2) < manager(3) < admin(4) < süper admin
- Oturum: `localStorage['te_cur']` (getSession/setSession/clearSession)

---

## 6. ÖNEMLİ ÖZELLİKLER (hepsi MEVCUT ve çalışıyor)
1. **Multi-tenant:** Her şirket izole veri. Süper admin tüm şirketleri yönetir, aralarında geçiş yapar.
2. **Süper admin sol panel** (`#company-sidebar`): geniş ekranda şirket listesi solda sabit.
3. **Şirketler ekranı navbar** (alt): Şirketler / **Türler** / QR / Raporlar / Profil.
4. **TÜRLER (global tür yönetimi):** Navbar'daki "Türler" → `openGlobalTypeManager()` → şirket-içi Ekipmanlar ekranının BİREBİR aynısını açar (tam ekran, pop-up DEĞİL) + "Tüm Şirketlere Uygula" bandı. KULLANICI POP-UP İSTEMİYOR, tam ekran şart.
5. **Global tür/form uygulama** (`applyGlobalCatsToAll`): VERİ KAYBI KORUMASI var — şirketin kendi özel türleri korunur, global'ler eklenir; geçmiş raporlar kendi form kopyasını korur (yeni denetimler güncel formu kullanır).
6. **Belge yönetimi:** Şirket belge ağacı (ana sayfa sağ), otomatik dosyalama (Mahal→Ekipman→Tür), manuel klasör, genel evraklar (süper admin). Klasörlere "📎 Belge Ekle" butonu.
7. **Belge tarama:** Uygulama içi tarayıcı KALDIRILDI (web'de Apple kalitesi imkânsız — kullanıcı onayladı). "Belge Ekle" menüsü telefonun kendi Belge Tara özelliğine yönlendirir (iPhone: Dosyalar/Notlar; Android: Drive) + "Cihazdan Yükle" ön planda. Ayrıca ÇÖP KUTUSU: silinen belgeler 30 gün `takipet/trash`'te tutulur, süper admin geri alabilir.
8. **Risk Analizi** (`openRiskAnalysis`, `exportRiskPdf`): Raporlar sayfasında. Ekipman denetim durumu özeti + mahal bazında risk + gecikmiş/uygunsuz listeler + PDF çıktı.
9. **Yedekleme** (`openBackupManager`): Her gün TR 03:00 otomatik (`trBackupDayKey`, gün bazlı). KATMANLI geri yükleme: şirket/mahal/üye AYRI AYRI ve TEK TEK (`restoreMahal`, `restoreUser`). Bir mahal geri yüklenince diğerleri+yeni eklenenler KORUNUR.
10. **Hata Takibi** (`setupErrorTracking`, `openErrorLogs`): Otomatik JS hata yakalama (window.error + unhandledrejection), Firebase `errorLogs`'a kayıt (şirket, kullanıcı, mesaj, nerede, cihaz, zaman), süper admin "🔴 Hata Kayıtları" ekranı, temizleme, son 100 tut, spam önleme (60sn throttle).
11. **Bildirimler:** Denetim sonrası yöneticilere bildirim, zil/badge (`updateNotifBell`). Manager+ ve `view_notifications` yetkisi olanlar görür.
12. **F5 restore:** Süper admin bir şirkete girince `activeCompanyId` session'a yazılır, F5'te o şirkete geri döner.

---

## 7. ÇALIŞMA TARZI / DERSLER (ÇOK ÖNEMLİ)
- **Kullanıcı build'i deploy edip HARD REFRESH yapmazsa eski sürümü görür** (PWA cache). "Yapmadın" derse, çoğu zaman deploy/cache sorunudur — önce build çıktısında özelliğin VAR olduğunu grep ile kanıtla.
- **Use-before-declaration bug'ına dikkat:** Bu projede `let _globalDocs`, `let _docTreeOpen` gibi değişkenler tanımlanmadan önce kullanılınca "X is not defined" hatası TÜM render'ı çökertti (şirketler görünmedi). Yeni global değişken eklerken ERKEN yüklenen modüle koy (02-state-yardimci.js sonu ya da 03'ün başındaki let _db bölgesi) — modüller ad sırasına göre yüklenir.
- **HER build sonrası:** build.py zaten node --check yapar; ek olarak HTML onclick/onchange → fonksiyon eşleşmesini grep ile kontrol et.
- **Render çağrılarını try/catch'e al** ki bir alt-bileşen hatası ana ekranı çökertmesin.
- Test edilmemiş build'lerin üstüne sürekli yeni şey ekleme — kullanıcı kafası karışıyor.
- Kullanıcı genelde tek seferde birkaç sorun bildirir; hepsini tek tek, sırayla çöz.

---

## 8. BİLİNEN PLATFORM/MİMARİ SINIRLARI
- Android PWA status bar siyah — ÇÖZÜLEMEZ (platform sınırı).
- iOS PWA localStorage bazen temizlenir.
- Gerçek push bildirimi YOK (uygulama-içi bildirim var).
- Otomatik yedek tam 03:00'te çalışamaz (PWA, sunucu değil) — 03:00 sonrası ilk süper admin girişinde alınır. Gerçek zamanlı yedek için Cloud Function gerekir (gelecek iş).
- Eşzamanlı yazma %100 kusursuzluk gerçek backend + transaction gerektirir (kullanıcı "sıkıntı yok" dedi, şimdilik atlandı).

---

## 9. GELECEK / YOL HARİTASI (SaaS dönüşümü — 2026-07-02'de kararlaştırıldı)
Büyük hedef: landing page + üyelik planları (Grup şirket / Tekil şirket) + yeni süper admin paneli.
- **FAZ 1 — Modüler mimari: TAMAMLANDI (2026-07-02).** app.js → src/js/ 22 modül; çıktı bayt bayt aynı kanıtlandı.
- **FAZ 2 — Backend + gerçek auth (Blaze + Cloud Functions):** e-posta/şifre hesap, tenant izolasyonu, sunucu tarafı plan limitleri, FCM push, gerçek 03:00 yedek. Üyelik sisteminin ÖNKOŞULU.
- **FAZ 3 — SaaS build:** public landing (tanıtım/fiyat/iletişim/üye ol), plana göre panel yönlendirme, süper admin paneli genişletme (üye yönetimi, plan limitleri, landing içeriğini kodsuz düzenleme), domain + Firebase Hosting + ödeme (iyzico/Stripe). Detay: memory saas-roadmap.md.
- **KVKK uyumu:** ticari satış öncesi önemli.

---

## 10. İLK YAPMAN GEREKENLER (Claude Code'da)
1. Bu dosyayı oku. ✅
2. `cd src && python build.py` çalıştır (node --check otomatik yapılır).
3. Git zaten kurulu: origin = `github.com/cankonuralp/ekipman-takip` (branch main). Kurulum 2026-06-30'da yapıldı. ✅
4. Kullanıcı (reisim) `git push` sonrası canlı siteyi test edecek; bildirdiği sorunları sırayla çöz.
5. Her değişiklikte: modülleri düzenle (src/js/) → build → grep ile teyit → git push.

Başarılar. Reisim'e iyi bak. 🔧
