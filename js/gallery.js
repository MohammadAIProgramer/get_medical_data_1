// کلاس گالری: مدیریت تصاویر کوچک، عملیات دانلود و حذف به‌صورت نمونه‌پذیر
export class Gallery {
  constructor(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('وجود ظرف گالری لازم است');
    this.container = container;
    this.thumbs = container.querySelector('.thumbs') || (function(){
      const t = document.createElement('div'); t.className = 'thumbs'; container.append(t); return t;
    })();
  }

  add(dataUrl, filename = 'photo.png', meta = {}) {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = dataUrl; img.alt = filename;

    const actions = document.createElement('div'); actions.className = 'actions';
    const dl = document.createElement('button'); dl.innerHTML = '⬇️'; dl.title = 'دانلود'; dl.setAttribute('aria-label','دانلود');
    const del = document.createElement('button'); del.innerHTML = '🗑️'; del.title = 'حذف'; del.setAttribute('aria-label','حذف');
    actions.append(dl, del);

    const metaWrap = document.createElement('div'); metaWrap.className = 'meta';
    const pid = document.createElement('div'); pid.textContent = meta.patientId ? `بیمار: ${meta.patientId}` : 'بیمار: —';
    const side = document.createElement('div'); side.textContent = meta.side ? `${meta.side}` : ''; side.className = 'small';
    const ts = document.createElement('div'); ts.textContent = meta.timestamp ? `${meta.timestamp}` : ''; ts.className = 'small';
    metaWrap.append(pid, side, ts);

    thumb.append(img, metaWrap, actions);
    this.thumbs.prepend(thumb);

    dl.addEventListener('click', () => {
      const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
    });
    del.addEventListener('click', () => thumb.remove());
    return thumb;
  }

  clear() {
    this.thumbs.innerHTML = '';
  }

  element() { return this.container; }
  
  // helpers for gallery conversion
  static async srcToBlob(url) {
    if (!url) return null;
    if (url.startsWith('data:')) {
      const parts = url.split(',');
      const metaMatch = parts[0].match(/data:(.*);base64/);
      if (!metaMatch) return null;
      const mime = metaMatch[1];
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      return new Blob([u8], { type: mime });
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      console.warn('srcToBlob fetch failed', e);
      return null;
    }
  }

  static async collectImagesFromGallery(selectorPrefix) {
    const thumbs = document.querySelectorAll(`${selectorPrefix} .thumbs img`);
    const files = [];
    let idx = 1;
    for (const img of thumbs) {
      const src = img.src;
      try {
        const blob = await Gallery.srcToBlob(src);
        if (!blob) continue;
        const ext = blob.type ? blob.type.split('/').pop() : 'jpg';
        const side = selectorPrefix.includes('left') ? 'left' : 'right';
        const filename = `${side}-${idx}.${ext}`;
        const file = new File([blob], filename, { type: blob.type || `image/${ext}` });
        files.push(file);
        idx++;
      } catch (err) {
        console.warn('خطا در تبدیل تصویر به Blob:', err);
      }
    }
    return files;
  }

  // helper: try multiple element ids for a logical field
  static getFieldValue(possibleIds) {
    for (const id of possibleIds) {
      const el = document.getElementById(id);
      if (el) return el.value || '';
    }
    return '';
  }
}
