import { CameraModel } from './model.js';
import { Gallery } from './gallery.js';

export class PaneController {
	// view: PaneView, sharedState: object, options: { gallery: Gallery }
	constructor(view, sharedState, options = {}) {
		this.view = view;
		this.model = new CameraModel();
	this.shared = sharedState; // برای تضمین تنها یک پنل فعال استفاده می‌شود
	this.gallery = options.gallery instanceof Gallery ? options.gallery : null;

	// پشتیبانی تمرکز: کلیک یک‌باره پنل را متمرکز کرده و در صورت نیاز دوربین را شروع می‌کند
		this.view.video.addEventListener('click', async () => {
			// set focus to this controller
			this.shared.focus = this;
			// clear outline on others
			if (this.shared.left && this.shared.left !== this) this.shared.left.view.video.style.outline = '';
			if (this.shared.right && this.shared.right !== this) this.shared.right.view.video.style.outline = '';
			this.view.video.style.outline = '3px solid #0b5fff';
			// If a preferred deviceId is stored, switch the select to it (if present)
			const pref = this.view.root.dataset.prefDeviceId;
			if (pref) {
				const opt = Array.from(this.view.select.options).find(o => o.value === pref);
				if (opt) this.view.select.value = pref;
			}
			// در صورتی که در حال پخش نباشد، دوربین را به‌صورت خودکار شروع کن
			if (!this.model.stream) await this.start();
		});

	// دو بار کلیک برای ثبت زمانی که متمرکز است
		this.view.video.addEventListener('dblclick', () => {
			if (this.shared.focus === this) this.snap();
		});

	// خارج کردن تمرکز هنگام کلیک در خارج از پنل‌ها
		document.addEventListener('click', (e) => {
			const rootEl = this.view.root;
			if (!rootEl.contains(e.target) && this.shared.focus === this) {
				// unfocus
				this.shared.focus = null;
				this.view.video.style.outline = '';
			}
		});
	}

	async start() {
		// if another pane is active, stop it
		if (this.shared.active && this.shared.active !== this) {
			await this.shared.active.stop();
		}

		const deviceId = this.view.select.value;
		try {
			// hide any previous captured photo before starting
			if (this.view.hidePhoto) this.view.hidePhoto();
			const stream = await this.model.open(deviceId);
			this.view.setStreaming(stream);
			this.shared.active = this;
					// بروزرسانی نشانگر با برچسب دستگاه انتخاب‌شده
					if (this.view.badge) this.view.badge.textContent = this.view.getSelectedLabel();
					// پیوست رفتار دکمه ثبت (pin)
					if (this.view.pinBtn) {
						this.view.pinBtn.onclick = () => {
							const devId = this.view.select.value;
							if (devId) {
								localStorage.setItem(`pref_${this.view.root.id}`, devId);
								this.view.pinBtn.title = 'ثبت‌شده';
							}
						};
						// restore pin state if present
						const saved = localStorage.getItem(`pref_${this.view.root.id}`);
						if (saved && this.view.select) {
							const opt = Array.from(this.view.select.options).find(o => o.value === saved);
							if (opt) this.view.select.value = saved;
						}
					}
		} catch (e) {
			console.error('خطا در شروع', e);
			alert('راه‌اندازی دوربین ممکن نیست: ' + e.message);
		}
	}

	snap() {
		const v = this.view.video;
		if (!v) return;
		const w = v.videoWidth || 640;
		const h = v.videoHeight || 480;
		const c = document.createElement('canvas');
		c.width = w; c.height = h;
		const ctx = c.getContext('2d');
		ctx.drawImage(v, 0, 0, w, h);
		const dataUrl = c.toDataURL('image/png');

		// تعیین گالری مناسب بر اساس شناسه پنل (انتظار می‌رود 'left' یا 'right' باشد)
		const side = (this.view.root && (this.view.root.id || this.view.root.dataset.side)) || 'left';
		const patientId = (document.getElementById('patient-id') || {}).value || '';
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		// use Persian labels for metadata and filename
		const sideLabel = side === 'right' ? 'راست' : 'چپ';
		const filename = `${patientId || 'بیمار'}_${sideLabel}_${timestamp}.png`;
			// flash effect
			this.view.video.classList.add('flash');
			setTimeout(() => this.view.video.classList.remove('flash'), 120);
		// اگر یک نمونه گالری تزریق‌شده داریم از آن استفاده کن، وگرنه به DOM مستقیم fallback کن
		if (this.gallery) {
			this.gallery.add(dataUrl, filename, { patientId, side: sideLabel, timestamp });
		} else {
			const galleryId = side === 'right' ? 'gallery-right' : 'gallery-left';
			const galleryEl = document.getElementById(galleryId);
			if (!galleryEl) {
				console.warn('عنصر گالری یافت نشد:', galleryId);
				return;
			}
			// fallback to previous procedural helper behavior by directly manipulating DOM (create a thumb)
			const thumbs = galleryEl.querySelector('.thumbs') || (function(){ const t = document.createElement('div'); t.className='thumbs'; galleryEl.append(t); return t; })();
			const thumb = document.createElement('div'); thumb.className = 'thumb';
			const img = document.createElement('img'); img.src = dataUrl; img.alt = filename;
			const actions = document.createElement('div'); actions.className = 'actions';
			const dl = document.createElement('button'); dl.innerHTML = '⬇️'; dl.title = 'دانلود'; dl.setAttribute('aria-label','دانلود');
			const del = document.createElement('button'); del.innerHTML = '🗑️'; del.title = 'حذف'; del.setAttribute('aria-label','حذف');
			actions.append(dl, del);
			const metaWrap = document.createElement('div'); metaWrap.className = 'meta';
			const pid = document.createElement('div'); pid.textContent = patientId ? `بیمار: ${patientId}` : 'بیمار: —';
			const sideEl = document.createElement('div'); sideEl.textContent = sideLabel; sideEl.className='small';
			const tsEl = document.createElement('div'); tsEl.textContent = timestamp; tsEl.className='small';
			metaWrap.append(pid, sideEl, tsEl);
			thumb.append(img, metaWrap, actions);
			thumbs.prepend(thumb);
			dl.addEventListener('click', () => { const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); });
			del.addEventListener('click', () => thumb.remove());
		}
	}

	stop() {
		this.model.close();
		this.view.setStopped();
		if (this.shared.active === this) this.shared.active = null;
	}

	download() {
		if (!this.view.photo || !this.view.photo.src) return;
		const url = this.view.photo.src;
		const a = document.createElement('a');
		a.href = url; a.download = (this.view.root.id || 'عکس') + '.png';
		a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
	}
}
