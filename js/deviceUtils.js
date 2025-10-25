// توابع کمکی برای انتخاب دستگاه و قوانین ساده
export function findUsbIndices(devices) {
  return devices
    .map((d, i) => ((d.label || '').toLowerCase().includes('usb') ? i : -1))
    .filter(i => i >= 0);
}

export function pickPreferredIndices(devices) {
  // بازگرداندن { leftIdx, rightIdx }
  const usb = findUsbIndices(devices);
  let leftIdx = 0, rightIdx = 0;
  if (usb.length >= 2) {
    leftIdx = usb[0];
    rightIdx = usb[1];
  } else if (usb.length === 1) {
    leftIdx = usb[0];
    rightIdx = usb[0];
  } else {
      // بازگشت به حالت پیش‌فرض: اولی برای چپ، دومی برای راست در صورت وجود
    leftIdx = devices.length > 0 ? 0 : -1;
    rightIdx = devices.length > 1 ? 1 : leftIdx;
  }
  return { leftIdx, rightIdx };
}

export function findDeviceIndexById(devices, deviceId) {
  return devices.findIndex(d => d.deviceId === deviceId);
}
