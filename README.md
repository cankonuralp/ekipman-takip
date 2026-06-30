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

## 2. DOSYA YAPISI (kaynak — bu klasör)
```
takipet-kaynak/
├── app.js               (~8700 satır — TÜM uygulama mantığı)
├── style.css            (~1000 satır)
├── index.html           (~880 satır body — script'siz, build inline eder)
├── qrcode-generator.js  (QR üretici kütüphane)
├── icons.json           (PNG ikonlar base64: apple, fav192, fav512, fav32)
├── build.py             (BUILD SCRIPT — tek dosya üretir)
└── dist/index.html      (BUILD ÇIKTISI — deploy edilen tek dosya)
```

---

## 3. BUILD NASIL ÇALIŞIR (ZORUNLU YÖNTEM)
```bash
python build.py          # style.css + qrcode + app.js → dist/index.html'e inline eder
node --check app.js      # HER build'den sonra ZORUNLU syntax kontrolü
```
- `build.py`, `index.html`'in body'sini alır, içindeki `<script>`leri siler, head'e Firebase SDK + QR + jsPDF CDN'lerini + base64 favicon/manifest ekler, sonuna qrcode-generator.js ve app.js'i inline gömer.
- **Deploy:** `dist/index.html` → GitHub Pages.
- **HER teslimde:** build → `node --check app.js` → çıktıda özelliğin VAR olduğunu grep ile teyit et → kullanıcıya ver → git commit/push komutu öner.

---

## 4. FIREBASE CONFIG (app.js başında, ~satır 5-15)
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

### Önemli sabitler/fonksiyonlar (app.js)
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
7. **PDF Tarayıcı** (`startScanner`): TAM EKRAN (z-index 12000, modal değil), canlı kenar tespiti (OpenCV), önizleme+onay akışı, RENKLİ çıktı. **FİLTRE YOK** (kullanıcı gri/netleştir istemiyor — renkli kalsın). Beceremezse kaldırılabilir (kullanıcı bunu söyledi).
8. **Risk Analizi** (`openRiskAnalysis`, `exportRiskPdf`): Raporlar sayfasında. Ekipman denetim durumu özeti + mahal bazında risk + gecikmiş/uygunsuz listeler + PDF çıktı.
9. **Yedekleme** (`openBackupManager`): Her gün TR 03:00 otomatik (`trBackupDayKey`, gün bazlı). KATMANLI geri yükleme: şirket/mahal/üye AYRI AYRI ve TEK TEK (`restoreMahal`, `restoreUser`). Bir mahal geri yüklenince diğerleri+yeni eklenenler KORUNUR.
10. **Hata Takibi** (`setupErrorTracking`, `openErrorLogs`): Otomatik JS hata yakalama (window.error + unhandledrejection), Firebase `errorLogs`'a kayıt (şirket, kullanıcı, mesaj, nerede, cihaz, zaman), süper admin "🔴 Hata Kayıtları" ekranı, temizleme, son 100 tut, spam önleme (60sn throttle).
11. **Bildirimler:** Denetim sonrası yöneticilere bildirim, zil/badge (`updateNotifBell`). Manager+ ve `view_notifications` yetkisi olanlar görür.
12. **F5 restore:** Süper admin bir şirkete girince `activeCompanyId` session'a yazılır, F5'te o şirkete geri döner.

---

## 7. ÇALIŞMA TARZI / DERSLER (ÇOK ÖNEMLİ)
- **Kullanıcı build'i deploy edip HARD REFRESH yapmazsa eski sürümü görür** (PWA cache). "Yapmadın" derse, çoğu zaman deploy/cache sorunudur — önce build çıktısında özelliğin VAR olduğunu grep ile kanıtla.
- **Use-before-declaration bug'ına dikkat:** Bu projede `let _globalDocs`, `let _docTreeOpen` gibi değişkenler tanımlanmadan önce kullanılınca "X is not defined" hatası TÜM render'ı çökertti (şirketler görünmedi). Yeni global değişken eklerken dosyanın BAŞINA (let _db yanına, ~satır 966) koy.
- **HER build sonrası:** `node --check app.js` + HTML onclick/onchange → app.js fonksiyon eşleşmesi kontrol et.
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

## 9. GELECEK / ERTELENEN İŞLER
- **Modüler mimariye geçiş (Vite):** 100 firmaya çıkmadan önce. Tek dosya 630 KB'a ulaştı; ölçeklenme için kod modüllere bölünmeli, lazy loading, parçalı build. Bu Claude Code'da yapılacak BÜYÜK iş. Kullanıcı bunu konuştu, hazır olunca yapılacak.
- **Domaine geçiş (custom domain):** Kullanıcı şimdilik "kalsın" dedi.
- **KVKK uyumu:** Kullanıcı şimdilik "kalsın" dedi. İkinci/ticari firmaya geçişte önemli.
- **Cloud Function ile gerçek 03:00 yedek + push bildirim:** Backend kurulunca.
- **Dış yedek (off-site):** Kullanıcı "gerek yok" dedi (Firebase-içi 03:00 yedek yeterli).

---

## 10. İLK YAPMAN GEREKENLER (Claude Code'da)
1. Bu dosyayı oku. ✅
2. `python build.py` çalıştır, `node --check app.js` ile doğrula.
3. Git deposunu kur (yoksa): `cankonuralp.github.io/ekipman-takip/` reposuna bağla.
4. Kullanıcı (reisim) en son `dist/index.html`'i deploy edip test edecek; bildirdiği sorunları sırayla çöz.
5. Her değişiklikte: build → node --check → grep ile teyit → commit/push.

Başarılar. Reisim'e iyi bak. 🔧
