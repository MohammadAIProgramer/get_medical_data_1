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
}
