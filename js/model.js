export class CameraModel {
	constructor() {
		this.stream = null;
		this.devices = [];
	}

	async enumerate() {
		if (!navigator.mediaDevices) throw new Error('مرورگر از MediaDevices پشتیبانی نمی‌کند');
		const devices = await navigator.mediaDevices.enumerateDevices();
		this.devices = devices.filter(d => d.kind === 'videoinput');
		return this.devices;
	}

	async open(deviceId) {
		if (!navigator.mediaDevices) throw new Error('مرورگر از MediaDevices پشتیبانی نمی‌کند');
		const constraints = deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: true };
		// stop existing
		if (this.stream) {
			this.close();
		}
		this.stream = await navigator.mediaDevices.getUserMedia(constraints);
		return this.stream;
	}

	close() {
		if (!this.stream) return;
		for (const t of this.stream.getTracks()) t.stop();
		this.stream = null;
	}

	static async init(left, right) {
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
	}
}
