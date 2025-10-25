// خیلی ساده: یک Event Bus کوچک برای ارتباط قطعات مختلف
const listeners = Object.create(null);

export const bus = {
  on(event, fn) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(fn);
    return () => listeners[event] && listeners[event].delete(fn);
  },
  emit(event, payload) {
    const s = listeners[event];
    if (!s) return;
    for (const fn of Array.from(s)) {
      try { fn(payload); } catch (e) { console.error('bus handler error', e); }
    }
  },
  clear(event) {
    if (!event) {
      for (const k of Object.keys(listeners)) delete listeners[k];
    } else {
      delete listeners[event];
    }
  }
};
