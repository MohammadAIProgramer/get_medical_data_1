export class PaneView {
	constructor(root) {
		this.root = root;
		this.select = root.querySelector('[data-role="deviceSelect"]');
		// دکمه‌ها در تجربه کاربری جدید حذف شدند؛ از کلیک/دو بار کلیک روی ویدیو استفاده کنید
		this.video = root.querySelector('[data-role="video"]');
			this.pinBtn = root.querySelector('[data-role="pinBtn"]');
			this.badge = root.querySelector('[data-role="badge"]');
		// گالری تصاویر گرفته‌شده را مدیریت می‌کند؛ view تنها به select و video نیاز دارد
		this.photo = null;
		this.photoBox = null;
		this.changeBtn = null;
		this.downloadBtn = null;
	}

	fillDevices(devices) {
		this.select.innerHTML = '';
		devices.forEach((d, i) => {
			const opt = document.createElement('option');
			opt.value = d.deviceId || '';
			opt.textContent = d.label || `دوربین ${i+1}`;
			this.select.append(opt);
		});
	}

	setStreaming(stream) {
		this.video.srcObject = stream;
		// هنگام پخش، تنها srcObject تنظیم می‌شود؛ منطق رابط کاربری توسط controller مدیریت می‌گردد
	}

	setStopped() {
		this.video.srcObject = null;
		// هنگام توقف ویدیو پاک می‌شود؛ منطق رابط کاربری توسط controller مدیریت می‌گردد
	}

	showPhoto(dataUrl) {
		// تابع نمایش عکس در سطح view استفاده نمی‌شود؛ گالری تصاویر ثبت‌شده را نمایش می‌دهد
		return;
	}

	hidePhoto() {
		// no-op for gallery mode
		if (this.video) this.video.hidden = false;
	}

		getSelectedLabel() {
			const opt = this.select.options[this.select.selectedIndex];
			return opt ? opt.textContent : '';
		}
}
