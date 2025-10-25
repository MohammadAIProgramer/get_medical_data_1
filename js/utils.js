import { Gallery } from './gallery.js';

export function downloadURL(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

  // main uploader
export async function uploadRecord({ url = '/api/records', authToken = null } = {}) {
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
  const leftFiles = await Gallery.collectImagesFromGallery('#gallery-left');
  leftFiles.forEach(f => form.append('leftImages', f, f.name));
  const rightFiles = await Gallery.collectImagesFromGallery('#gallery-right');
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