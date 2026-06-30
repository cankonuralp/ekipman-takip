/**
 * qrcode-generator.js
 * ─────────────────────────────────────────────
 * QR kod oluşturma katmanı — 3 kademeli fallback:
 *
 *  1. qrcodejs (CDN)          → gerçek taranabilir QR canvas
 *  2. api.qrserver.com (img)  → CDN yüklenmedi ama internet var
 *  3. Metin gösterimi         → tamamen offline / hata durumu
 *
 * Dışa açık API:
 *   QRGen.render(text, containerElement, size?)
 *   QRGen.download(containerElement, filename?)
 * ─────────────────────────────────────────────
 */

const QRGen = (() => {

  /* ── 1. qrcodejs canvas üreticisi ── */
  function renderWithLib(text, container, size) {
    container.innerHTML = '';
    new QRCode(container, {
      text,
      width:        size,
      height:       size,
      colorDark:    '#1A1D2E',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  /* ── 2. Uzak API görüntüsü (internet gerekli) ── */
  function renderWithAPI(text, container, size) {
    container.innerHTML = '';

    // Arka plan / metin fallback'i hemen koy (API yüklenmeden önce gösterilir)
    const fallback = textFallback(text, size);
    container.appendChild(fallback);

    const img = document.createElement('img');
    img.width  = size;
    img.height = size;
    img.style.cssText = 'display:block;border-radius:8px;';
    img.alt = 'QR Kod: ' + text;

    img.onload = () => {
      container.innerHTML = '';
      container.appendChild(img);
    };
    // img.onerror → fallback zaten yerinde, sessizce devam et

    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=H&data=${encodeURIComponent(text)}`;
  }

  /* ── 3. Metin fallback (her zaman çalışır) ── */
  function textFallback(text, size) {
    const div = document.createElement('div');
    div.style.cssText = `
      width:${size}px; min-height:${size}px;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background:#fff; border:2px solid #E5E7EB;
      border-radius:12px; padding:16px; gap:10px;
      font-family:monospace; text-align:center; box-sizing:border-box;
    `;
    div.innerHTML = `
      <div style="font-size:11px;color:#6B7280;letter-spacing:.5px;text-transform:uppercase">QR Kod</div>
      <div style="font-size:13px;font-weight:700;color:#1A1D2E;word-break:break-all;line-height:1.4">${text}</div>
      <div style="font-size:10px;color:#9CA3AF">Bu ID'yi ekipmana yapıştırın</div>
    `;
    return div;
  }

  /* ══ ANA FONKSİYON ══ */
  function render(text, container, size = 200) {
    if (!container) return null;
    container.innerHTML = '';

    // Kademe 1: qrcodejs CDN yüklendi mi?
    if (typeof QRCode !== 'undefined') {
      try {
        renderWithLib(text, container, size);
        const canvas = container.querySelector('canvas');
        return canvas ? canvas.toDataURL('image/png') : null;
      } catch (err) {
        console.warn('[QRGen] qrcodejs hatası, API fallback deneniyor:', err);
      }
    }

    // Kademe 2: İnternet bağlantısı varsa uzak API
    if (navigator.onLine) {
      renderWithAPI(text, container, size);
      return null; // async yükleniyor, URL şu an mevcut değil
    }

    // Kademe 3: Tamamen offline — metin göster
    container.appendChild(textFallback(text, size));
    return null;
  }

  /* ══ İNDİRME ══ */
  function download(container, filename = 'qr-kod.png') {
    // Önce canvas dene (qrcodejs)
    const canvas = container.querySelector('canvas');
    if (canvas) {
      const a = document.createElement('a');
      a.download = filename;
      a.href     = canvas.toDataURL('image/png');
      a.click();
      return;
    }

    // Sonra img dene (API görüntüsü)
    const img = container.querySelector('img');
    if (img && img.complete && img.naturalWidth > 0) {
      // Cross-origin canvas'a çiz, indir
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth || 200;
      cvs.height = img.naturalHeight || 200;
      try {
        cvs.getContext('2d').drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.download = filename;
        a.href     = cvs.toDataURL('image/png');
        a.click();
      } catch {
        // CORS engeli — yeni sekmede aç
        window.open(img.src, '_blank');
      }
      return;
    }

    alert('QR kodu henüz hazır değil veya indirilemedi.');
  }

  return { render, download };
})();
