// app.js — اصلاح‌شده برای سازگاری با سرور Dart (ارسال صحیح FormData و فیلدها)
// نکات کلیدی:
// - از نام فیلدهایی که سرور انتظار دارد استفاده می‌کنیم: patientId, attachment, leftImages, rightImages
// - patient id از دو محل می‌آید: ورودی toolbar با id 'patient-id' یا textarea 'patient-desc-id'
// - اگر کاربر فایلی انتخاب نکرده اما auto-attached وجود دارد، آن را می‌فرستیم
// - لاگ کامل FormData و پاسخ سرور در هر حالت چاپ می‌شود تا خطاها بهتر دیده شوند
// - حتماً هدر 'Content-Type' را دستی تنظیم نکنید

import { PaneView } from './view.js';
import { PaneController } from './controller.js';
import { CameraModel } from './model.js';
import { uploadRecord } from './utils.js';
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
  CameraModel.init(left, right);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (shared.focus) shared.focus.snap();
    }
  });

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


  // bind to save button
  const saveBtn = document.getElementById('save-record');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'در حال ارسال...';
        const res = await uploadRecord({ 
          url: '/api/records',
        });
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
