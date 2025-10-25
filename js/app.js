// app.js — اصلاح‌شده برای سازگاری با سرور Dart (ارسال صحیح FormData و فیلدها)
// نکات کلیدی:
// - از نام فیلدهایی که سرور انتظار دارد استفاده می‌کنیم: patientId, attachment, leftImages, rightImages
// - patient id از دو محل می‌آید: ورودی toolbar با id 'patient-id' یا textarea 'patient-desc-id'
// - اگر کاربر فایلی انتخاب نکرده اما auto-attached وجود دارد، آن را می‌فرستیم
// - لاگ کامل FormData و پاسخ سرور در هر حالت چاپ می‌شود تا خطاها بهتر دیده شوند
// - حتماً هدر 'Content-Type' را دستی تنظیم نکنید

import { PaneView } from './view.js';
import { PaneController } from './controller.js';
import { pickPreferredIndices } from './deviceUtils.js';
import { Gallery } from './gallery.js';

const shared = { active: null, focus: null };

function setupPane(id) {
  const root = document.getElementById(id);
  if (!root) {
    console.warn('Pane root not found for', id);
    return { view: null, ctrl: null };
  }
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
    if (left.view && left.view.fillDevices) left.view.fillDevices(devices);
    if (right.view && right.view.fillDevices) right.view.fillDevices(devices);

    const { leftIdx, rightIdx } = pickPreferredIndices(devices);
    if (left.view && left.view.select) left.view.select.selectedIndex = leftIdx >= 0 ? leftIdx : 0;
    if (right.view && right.view.select) right.view.select.selectedIndex = rightIdx >= 0 ? rightIdx : (devices.length > 1 ? 1 : 0);
    if (devices[leftIdx] && left.view) left.view.root.dataset.prefDeviceId = devices[leftIdx].deviceId;
    if (devices[rightIdx] && right.view) right.view.root.dataset.prefDeviceId = devices[rightIdx].deviceId;
  } catch (e) {
    console.error('شمارش دستگاه‌ها ناموفق بود', e);
  }

  // file attach controls
  const fileInput = document.getElementById('attach-file');
  const fileNameDisplay = document.getElementById('attach-file-name');
  window._autoAttachedFile = null; // holds File if auto-attached

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (f) {
        console.log('User selected attachment:', f.name, f.type, f.size);
        if (fileNameDisplay) fileNameDisplay.textContent = f.name;
        window._autoAttachedFile = null; // user-provided overrides auto-attached
      } else {
        if (fileNameDisplay) fileNameDisplay.textContent = '';
      }
    });
  }

  const autoFileAttach = document.getElementById('auto-attach-file');
  if (autoFileAttach) {
    autoFileAttach.addEventListener('click', async() => {
      try {
        console.log('auto-attach: requesting /latest-file');
        const resp = await fetch('/latest-file');
        if (!resp.ok) {
          alert('دریافت آخرین فایل ناموفق: ' + resp.status);
          return;
        }
        const info = await resp.json();
        if (!info || !info.url) {
          alert('هیچ فایل جدیدی یافت نشد');
          return;
        }
        // fetch the file blob from provided URL
        const fileResp = await fetch(info.url);
        if (!fileResp.ok) {
          alert('بارگیری فایل ناموفق: ' + fileResp.status);
          return;
        }
        const blob = await fileResp.blob();
        const filename = info.name || ('file_' + Date.now());
        const type = blob.type || 'application/octet-stream';
        const file = new File([blob], filename, { type });
        window._autoAttachedFile = file;
        if (fileNameDisplay) fileNameDisplay.textContent = '[auto] ' + filename;
        console.log('Auto-attached file ready:', filename, file.type, file.size);
        alert('فایل به صورت خودکار پیوست شد: ' + filename);
      } catch (err) {
        console.error('auto-attach failed', err);
        alert('خطا در دریافت آخرین فایل: ' + err.message);
      }
    });
  }
  
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (shared.focus) shared.focus.snap();
    }
  });


  const clearLeft = document.getElementById('clear-left');
  const clearRight = document.getElementById('clear-right');
  if (clearLeft) clearLeft.addEventListener('click', () => {
    const c = document.querySelector('#gallery-left .thumbs'); if (c) c.innerHTML = '';
  });
  if (clearRight) clearRight.addEventListener('click', () => {
    const c = document.querySelector('#gallery-right .thumbs'); if (c) c.innerHTML = '';
  });

  // Speech-to-text unchanged
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

  // helpers for gallery conversion
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
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch (e) {
      console.warn('srcToBlob fetch failed', e);
      return null;
    }
  }

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

  // helper: try multiple element ids for a logical field
  function getFieldValue(possibleIds) {
    for (const id of possibleIds) {
      const el = document.getElementById(id);
      if (el) return el.value || '';
    }
    return '';
  }

  // main uploader
  async function uploadRecord({ url = '/api/records', authToken = null } = {}) {
    const name = (document.getElementById('patient-desc-name') || {}).value || '';
    const age = (document.getElementById('patient-desc-age') || {}).value || '';
    // read toolbar patient-id too
    const pid = (document.getElementById('patient-desc-id') || document.getElementById('patient-id') || {}).value || '';
    const desc = (document.getElementById('patient-desc') || {}).value || '';

    if (!pid || !String(pid).trim()) {
      throw new Error('patientId is required — لطفاً شناسه بیمار را وارد کنید.');
    }

    const form = new FormData();
    form.append('patientName', name);
    form.append('patientAge', age);
    form.append('patientId', pid);
    form.append('description', desc);
    form.append('timestamp', new Date().toISOString());

    const attachInput = document.getElementById('attach-file');
    if (attachInput && attachInput.files && attachInput.files.length > 0) {
      form.append('attachment', attachInput.files[0], attachInput.files[0].name);
    } else if (window._autoAttachedFile) {
      form.append('attachment', window._autoAttachedFile, window._autoAttachedFile.name);
    }

    const leftFiles = await collectImagesFromGallery('#gallery-left');
    leftFiles.forEach(f => form.append('leftImages', f, f.name));

    const rightFiles = await collectImagesFromGallery('#gallery-right');
    rightFiles.forEach(f => form.append('rightImages', f, f.name));

    // enumerate form for debugging
    try {
      const entries = [];
      for (const pair of form.entries()) {
        if (pair[1] instanceof File) entries.push([pair[0], pair[1].name]);
        else entries.push([pair[0], String(pair[1])]);
      }
      console.log('FormData to send:', entries);
    } catch (e) {
      console.warn('Could not enumerate FormData entries', e);
    }

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
        const text = xhr.responseText || '';
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(text || '{}')); }
          catch (e) { resolve({ status: xhr.status, text }); }
        } else {
          console.error('Upload failed:', xhr.status, xhr.statusText, text);
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.statusText + '\n' + text));
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
        const res = await uploadRecord({ url: '/api/records' });
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
  } else {
    console.warn('save-record button not found');
  }

  console.log('app.init completed');
}

init();
