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
}
