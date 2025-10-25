import { PaneView } from './view.js';
import { PaneController } from './controller.js';
import { pickPreferredIndices } from './deviceUtils.js';
import { Gallery } from './gallery.js';

const shared = { active: null, focus: null };

function setupPane(id) {
  const root = document.getElementById(id);
  const view = new PaneView(root);
  const galleryEl = document.querySelector(`#${id} ~ .galleries .gallery[data-side="${id}"]`);
  const gallery = galleryEl ? new Gallery(galleryEl) : null;
  const ctrl = new PaneController(view, shared, { gallery });
  return { view, ctrl };
}

async function init() {
  const left = setupPane('left');
  const right = setupPane('right');
  shared.left = left.ctrl;
  shared.right = right.ctrl;

  try {
    const CameraModel = (await import('./model.js')).CameraModel;
    let devices = await (new CameraModel()).enumerate();
    const needLabels = devices.every(d => !d.label);
    if (needLabels && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        for (const t of tempStream.getTracks()) t.stop();
        devices = await (new CameraModel()).enumerate();
      } catch (permErr) {
        console.warn('درخواست دسترسی رد یا ناموفق بود', permErr);
      }
    }
    left.view.fillDevices(devices);
    right.view.fillDevices(devices);

    const { leftIdx, rightIdx } = pickPreferredIndices(devices);
    left.view.select.selectedIndex = leftIdx >= 0 ? leftIdx : 0;
    right.view.select.selectedIndex = rightIdx >= 0 ? rightIdx : (devices.length > 1 ? 1 : 0);
    left.view.root.dataset.prefDeviceId = devices[leftIdx] ? devices[leftIdx].deviceId : '';
    right.view.root.dataset.prefDeviceId = devices[rightIdx] ? devices[rightIdx].deviceId : '';
  } catch (e) {
    console.error('شمارش دستگاه‌ها ناموفق بود', e);
  }

  const autoFileAttach = document.getElementById('auto-attach-file');
  if (autoFileAttach) {
    autoFileAttach.addEventListener('click', async() => {
      try {
        let x = await fetch("http://localhost:8001/", { method: "GET" });
        let y = await x.text();
        console.log([...x.headers.entries()]);
        console.log("auto-attach-file", y);
      } catch (err) {
        console.error('خطا در فراخوانی سرور محلی:', err);
      }
    });
  }

  const clearLeft = document.getElementById('clear-left');
  const clearRight = document.getElementById('clear-right');
  if (clearLeft) clearLeft.addEventListener('click', () => {
    const c = document.querySelector('#gallery-left .thumbs'); if (c) c.innerHTML = '';
  });
  if (clearRight) clearRight.addEventListener('click', () => {
    const c = document.querySelector('#gallery-right .thumbs'); if (c) c.innerHTML = '';
  });

  const fileInput = document.getElementById('attach-file');
  let currentPreviewUrl = null;
  const overlay = document.createElement('div'); overlay.className = 'preview-overlay';
  overlay.innerHTML = `<div class="preview-box"><div class="preview-toolbar"><div class="title">پیش‌نمایش</div><div><button class="preview-close">بستن</button></div></div><iframe class="preview-iframe" sandbox="allow-same-origin"></iframe></div>`;
  document.body.append(overlay);
  const iframe = overlay.querySelector('.preview-iframe');
  const closeBtn = overlay.querySelector('.preview-close');
  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
    iframe.src = 'about:blank';
  });

  if (fileInput) {
    let handleFileInput = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const allowed = ['application/pdf','text/html','text/plain'];
      if (!allowed.includes(f.type) && !f.name.toLowerCase().endsWith('.html')) {
        alert('لطفاً یک فایل PDF یا HTML انتخاب کنید');
        return;
      }
      if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
      currentPreviewUrl = URL.createObjectURL(f);
      iframe.src = currentPreviewUrl;
      overlay.classList.add('active');
    };
    fileInput.addEventListener('change', handleFileInput);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (shared.focus) shared.focus.snap();
    }
  });

  const fileNameDisplay = document.getElementById('attach-file-name');
  if (fileInput && fileNameDisplay) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
      } else {
        fileNameDisplay.textContent = '';
      }
    });
  }

  // --- Speech-to-Text integration (append finalized sentences) ---
  (function initSpeech() {
    const desc = document.getElementById('patient-desc');
    if (!desc) return;

    const speechBtn = document.createElement('button');
    speechBtn.id = 'start-speech';
    speechBtn.type = 'button';
    speechBtn.className = 'btn';
    speechBtn.textContent = '🎤 ضبط صدا';

    const speechStatus = document.createElement('span');
    speechStatus.id = 'speech-status';
    speechStatus.className = 'muted';
    speechStatus.style.marginInlineStart = '8px';

    const header = document.querySelector('.patient-desc-header');
    if (header) {
      header.appendChild(speechBtn);
      header.appendChild(speechStatus);
    } else {
      desc.parentNode.insertBefore(speechBtn, desc);
      desc.parentNode.insertBefore(speechStatus, desc);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speechBtn.disabled = true;
      speechStatus.textContent = 'مرورگر شما Speech API را پشتیبانی نمی‌کند';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-IR';
    recognition.interimResults = true;
    recognition.continuous = true;

    let bufferFinal = desc.value ? String(desc.value).trim() : '';

    recognition.onstart = () => {
      bufferFinal = desc.value ? String(desc.value).trim() : '';
    };

    recognition.onresult = (e) => {
      if (!desc) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) {
          bufferFinal = bufferFinal ? (bufferFinal + ' ' + transcript) : transcript;
        } else {
          interim += transcript + ' ';
        }
      }
      desc.value = (bufferFinal + (interim ? ' ' + interim.trim() : '')).trim();
    };

    recognition.onerror = (err) => {
      console.error('Speech recognition error', err);
      speechStatus.textContent = 'خطا در تشخیص گفتار';
    };

    recognition.onend = () => {
      speechBtn.textContent = '🎤 ضبط صدا';
      speechStatus.textContent = '';
    };

    let recognizing = false;
    speechBtn.addEventListener('click', () => {
      if (!recognizing) {
        try {
          recognition.start();
          recognizing = true;
          speechBtn.textContent = '⏹ توقف';
          speechStatus.textContent = 'در حال گوش دادن...';
        } catch (e) {
          console.error('Could not start recognition', e);
          speechStatus.textContent = 'شروع ضبط ممکن نیست';
        }
      } else {
        recognition.stop();
        recognizing = false;
        speechBtn.textContent = '🎤 ضبط صدا';
        speechStatus.textContent = 'توقف شد';
      }
    });
  })();

  // --- helper: convert data/data-urls or blob-urls to Blob ---
  async function srcToBlob(url) {
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
    const res = await fetch(url);
    return await res.blob();
  }

  // collect images from gallery and return array of File objects
  async function collectImagesFromGallery(selectorPrefix) {
    const thumbs = document.querySelectorAll(`${selectorPrefix} .thumbs img`);
    const files = [];
    let idx = 1;
    for (const img of thumbs) {
      const src = img.src;
      try {
        const blob = await srcToBlob(src);
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

  // main uploader
  async function uploadRecord({ url = 'http://localhost:8001/api/records', authToken = null } = {}) {
    const name = (document.getElementById('patient-desc-name') || {}).value || '';
    const age = (document.getElementById('patient-desc-age') || {}).value || '';
    const pid = (document.getElementById('patient-desc-id') || {}).value || '';
    const desc = (document.getElementById('patient-desc') || {}).value || '';

    const form = new FormData();
    form.append('patientName', name);
    form.append('patientAge', age);
    form.append('patientId', pid);
    form.append('description', desc);
    form.append('timestamp', new Date().toISOString());

    const attachInput = document.getElementById('attach-file');
    if (attachInput && attachInput.files && attachInput.files.length > 0) {
      form.append('attachment', attachInput.files[0], attachInput.files[0].name);
    }

    const leftFiles = await collectImagesFromGallery('#gallery-left');
    leftFiles.forEach(f => form.append('leftImages[]', f, f.name));

    const rightFiles = await collectImagesFromGallery('#gallery-right');
    rightFiles.forEach(f => form.append('rightImages[]', f, f.name));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      if (authToken) xhr.setRequestHeader('Authorization', authToken);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          console.log('upload progress', percent, '%');
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText || '{}')); }
          catch (e) { resolve({ status: xhr.status, text: xhr.responseText }); }
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.statusText));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(form);
    });
  }

  // bind to save button
  const saveBtn = document.getElementById('save-record');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'در حال ارسال...';
        const res = await uploadRecord({ url: 'http://localhost:8001/api/records' });
        console.log('Server response', res);
        if (res && res.ok) {
          alert('اطلاعات با موفقیت ارسال شد');
        } else {
          alert('ارسال کامل نشد');
        }
      } catch (err) {
        console.error(err);
        alert('ارسال با خطا مواجه شد: ' + (err.message || err));
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'ذخیره';
      }
    });
  }

}

init();
