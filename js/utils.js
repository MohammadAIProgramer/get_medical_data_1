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
