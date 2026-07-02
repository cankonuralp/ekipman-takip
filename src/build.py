#!/usr/bin/env python3
"""
TakipEt — Tek Dosya Build Script
================================
Kaynak dosyaları (src/js/*.js modülleri + style.css + qrcode-generator.js) tek bir
index.html içine inline eder. Çıktı: repo kökü index.html (GitHub Pages yayınlar).

Uygulama kodu src/js/ altında SIRALI modüllerdedir (01-, 02-, ...). Build bunları
ad sırasına göre birleştirir — global scope korunur, davranış tek dosyayla birebir aynı.
Yeni modül eklerken sıra numarası ver; tanımlar kullanımdan önce gelmeli.

Kullanım:
    python build.py    (node varsa her modülü + bütünü otomatik node --check eder)
"""
import re, json, base64, os, sys, glob, shutil, subprocess

# Windows konsolu (cp1254) emoji basamaz; çıktıyı UTF-8'e zorla.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()

def read_js_bundle():
    """src/js/*.js dosyalarını AD SIRASINA göre birleştir (01-, 02-, ...)."""
    files = sorted(glob.glob(os.path.join(ROOT, 'js', '*.js')))
    if not files:
        raise SystemExit('HATA: src/js/*.js bulunamadı — modüller nerede?')
    out = []
    for f in files:
        with open(f, encoding='utf-8', newline='') as fh:
            out.append(fh.read())
    return ''.join(out), files

def node_check(files, bundle):
    """Her modülü ve birleşik bütünü node --check ile doğrula (node varsa)."""
    node = shutil.which('node')
    if not node:
        print('⚠️  UYARI: node bulunamadı — syntax kontrolü atlandı!')
        return
    for f in files:
        r = subprocess.run([node, '--check', f], capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f'❌ SYNTAX HATASI {os.path.basename(f)}:\n{r.stderr}')
    tmp = os.path.join(ROOT, 'js', '_bundle.tmp.js')
    with open(tmp, 'w', encoding='utf-8', newline='') as fh:
        fh.write(bundle)
    r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    if r.returncode != 0:
        raise SystemExit(f'❌ SYNTAX HATASI (birleşik bundle):\n{r.stderr}')
    print(f'✅ node --check: {len(files)} modül + bundle TEMİZ')

def main():
    # 1) Kaynakları oku
    css  = read('style.css')
    qr   = read('qrcode-generator.js')
    app, js_files = read_js_bundle()
    node_check(js_files, app)
    html = read('index.html')
    icons = json.loads(read('icons.json'))

    # 2) İkonları base64 data-uri yap
    apple = f"data:image/png;base64,{icons['apple']}"
    i192  = f"data:image/png;base64,{icons['fav192']}"
    i512  = f"data:image/png;base64,{icons['fav512']}"
    i32   = f"data:image/png;base64,{icons['fav32']}"

    # 3) Manifest (PWA)
    manifest = {
        "name": "TakipEt — Denetim Sistemi",
        "short_name": "TakipEt",
        "start_url": "./", "scope": "./",
        "display": "standalone", "orientation": "portrait",
        "background_color": "#F5F7FA", "theme_color": "#F5F7FA",
        "icons": [
            {"src": i192, "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": i512, "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    }
    manifest_uri = f"data:application/manifest+json;base64,{base64.b64encode(json.dumps(manifest).encode()).decode()}"

    # 4) index.html body'sini al, içindeki <script> etiketlerini temizle
    body = html
    if '<body>' in body:
        body = re.search(r'<body>(.*?)</body>', body, re.DOTALL).group(1)
    body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)

    icon_head = f'''<link rel="icon" type="image/png" sizes="32x32" href="{i32}"/>
<link rel="icon" type="image/png" sizes="192x192" href="{i192}"/>
<link rel="apple-touch-icon" sizes="180x180" href="{apple}"/>
<link rel="apple-touch-icon" href="{apple}"/>
<link rel="manifest" href="{manifest_uri}"/>'''

    # 5) Birleştir
    out = f'''<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover"/>
<meta name="theme-color" content="#F5F7FA" media="(prefers-color-scheme: light)"/>
<meta name="theme-color" content="#0D1117" media="(prefers-color-scheme: dark)"/>
<meta name="theme-color" content="#F5F7FA" id="meta-theme-color"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<meta name="apple-mobile-web-app-title" content="TakipEt"/>
<meta name="mobile-web-app-capable" content="yes"/>
<title>TakipEt — Denetim Sistemi</title>
{icon_head}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{qr}
</script>
<script>
{app}
</script>
</body>
</html>'''

    # 6) Repo köküne index.html olarak yaz (src/ üst dizini = repo kökü).
    #    Pages bu kök index.html'i yayınlar; src/ içindeki kaynaklar versiyonlanır.
    repo_root = os.path.dirname(ROOT)          # .../takipet/src -> .../takipet
    out_path = os.path.join(repo_root, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(out)

    kb = len(out) // 1024
    print(f"✅ BUILD TAMAM: index.html ({kb} KB) -> repo kökü ({len(js_files)} JS modülü)")
    print("")
    print("Sonraki adım: git add -A && git commit && git push → GitHub Pages'e deploy")

if __name__ == '__main__':
    main()
