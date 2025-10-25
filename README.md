# Patient Eye Record Management — Developer Documentation

**Version:** 1.1  
**Date:** 2025-10-25

## Overview (General Purpose)

This web application provides a client-side interface for capturing and submitting clinical records focused on binocular eye imaging. The client captures left/right eye images, accepts attached files (PDF/HTML), and collects clinician notes. All data is packaged and sent to a server endpoint using `multipart/form-data`. Each patient has a unique identifier; the server stores each patient's assets in a dedicated folder named after that identifier and maintains metadata in a JSON file.

### Responsibilities
- **Client (frontend):** capture images, collect attachments, build `FormData`, upload records with progress feedback, and optionally auto-attach the latest server-provided file.
- **Server (backend):** receive multipart uploads, validate and sanitize input, store files under patient-specific folders, and return structured JSON responses.

---

## Repository Modules and Responsibilities

| File | Responsibility |
|------|----------------|
| `utils.js` | Extracts data from DOM and builds a `FormData` object ready to be uploaded. |
| `app.js` | Handles HTTP uploads, progress reporting, and response parsing. |
| `model.js` | Manages camera devices (enumeration, open/close) and initialization logic for dual-camera setup. |
| `gallery.js` | UI gallery management and utilities to convert displayed images into `File` objects. |
| `utils.js` | Small utilities such as `downloadURL()` and `readFileAsDataURL()` used across modules. |

---

## Function Reference (Detailed, English)

Below each function is documented with signature, parameters, return values, behavior, errors, and examples.

### `downloadURL(url, filename)`

**Signature:** `export function downloadURL(url, filename)`

**Purpose:** Programmatically triggers browser download of a resource located at `url`. Useful for downloading server-served files or Blob/data URLs generated on the client.

**Parameters:**
- `url` (`string`): The resource URL (http/https or blob/data URL).
- `filename` (`string`, optional): Suggested filename for saving.

**Returns:** `void` — initiates download.

**Behavior:** Creates a temporary `<a>` element with the `download` attribute, appends it to the document, triggers a click, and then removes it. When using blobs, prefer `URL.createObjectURL()` and remember to call `URL.revokeObjectURL()` afterwards.

**Example:**
```js
downloadURL('/files/report.pdf', 'report.pdf');
```

---

### `readFileAsDataURL(file)`

**Signature:** `export function readFileAsDataURL(file) -> Promise<string|null>`

**Purpose:** Reads a `File` or `Blob` and returns a `data:` URL (Base64) for preview or embedding in HTML/JSON.

**Parameters:**
- `file` (`File | Blob`): The file or blob to convert. If `null` or `undefined`, the promise resolves to `null`.

**Returns:** `Promise<string|null>` resolving to the data URL or `null`.

**Errors:** If `FileReader` fails, the promise rejects with an `Error('Failed to read file')`.

**Note:** Converting large images to data URLs can use significant memory; prefer `Blob` URLs for heavy files.

**Example:**
```js
const dataUrl = await readFileAsDataURL(file);
imageElem.src = dataUrl;
```

---

### `Gallery.collectImagesFromGallery(selectorPrefix)`

**Signature:** `async function collectImagesFromGallery(selectorPrefix) -> Promise<File[]>`

**Purpose:** Collects image thumbnails from a gallery DOM area, converts `data:` or blob URLs or remote URLs to `Blob`, wraps them into `File` objects, and returns an array of `File` instances suitable for appending to `FormData`.

**Parameters:**
- `selectorPrefix` (`string`): Prefix for the gallery container (e.g., `'#gallery-left'`). The function searches `${selectorPrefix} .thumbs img`.

**Returns:** `Promise<File[]>` a list of files in display order.

**Behavior:** For each `<img>` element, the function converts its `src` (data URL or fetch) into a `Blob`, constructs a `File` with a meaningful filename (e.g., `left-1.jpg`), and collects them. Conversion failures for individual images are logged and skipped.

**Example:**
```js
const leftFiles = await Gallery.collectImagesFromGallery('#gallery-left');
```

---

### `buildFormDataFromUI()` (recommended location: `utils.js`)

**Signature:** `export async function buildFormDataFromUI() -> Promise<FormData>`

**Purpose:** Reads patient and record fields from the DOM, validates required fields (notably `patientId`), collects attachment and gallery images, and produces a complete `FormData` ready for upload.

**Input:** None — function reads DOM directly. (For testability, consider creating a variant that accepts an object as input: `buildFormDataFromObject(record, files)`.)

**Returns:** `Promise<FormData>`.

**Form fields produced:**
- `patientName` (string)
- `patientAge` (string)
- `patientId` (string) — **required**
- `description` (string)
- `timestamp` (ISO string)
- `attachment` (File, optional) — from `input#attach-file` or `window._autoAttachedFile`
- `leftImages` (File, multi) — repeat these fields for each left image
- `rightImages` (File, multi) — repeat for right images

**Behavior:**
1. Read textual fields (`patient-desc-name`, `patient-desc-age`, `patient-desc-id` or `patient-id`, `patient-desc`).
2. Validate `patientId` exists and is not blank; otherwise throw an `Error`.
3. Construct a `FormData` and append textual fields and `timestamp`.
4. Append `attachment` if present.
5. Call `Gallery.collectImagesFromGallery` for left and right galleries and append images using the server-expected field names (`leftImages`, `rightImages`).

**Errors:** Throws if `patientId` is missing or other fatal state occurs.

**Example:**
```js
const form = await buildFormDataFromUI();
await sendFormData(form, { url: '/app/records' });
```

---

### `uploadRecord(options)` — (existing combined function; refactor recommended)

**Signature (current):** `export async function uploadRecord({ url = '/app/records', authToken = null } = {})`

**Purpose:** Convenience function in current code that both builds the `FormData` (from DOM) and performs the upload via XHR. For maintainability, it is recommended to split this behavior into `buildFormDataFromUI()` and `sendFormData()` as separate responsibilities.

**Behavior:** Builds `FormData`, logs entries for debugging, sends the data via `XMLHttpRequest`, registers `xhr.upload.onprogress` to report upload progress, and resolves with parsed JSON or raw text depending on server response.

**Errors:** Rejects on network errors or non-2xx HTTP status codes with an informative message including server response text.

**Recommendation:** Replace with the following flow for clarity:
```js
const form = await buildFormDataFromUI();
const response = await sendFormData(form, { url, authToken, onProgress });
```

---

### `sendFormData(formData, options)` (app.js)

**Signature:** `export async function sendFormData(formData, { url = '/app/records', authToken = null, onProgress = null } = {})`

**Purpose:** Uploads a `FormData` object to the specified endpoint. Uses `XMLHttpRequest` to gain access to `upload.onprogress` events. Parses JSON responses when possible.

**Parameters:**
- `formData` (`FormData`): The form to send.
- `url` (`string`, optional): Endpoint to POST to.
- `authToken` (`string|null`, optional): If provided, set as `Authorization` header.
- `onProgress` (`function(percent)` optional): Callback for upload progress percentage (0–100).

**Returns:** `Promise<any>` that resolves with parsed JSON or raw text on success, and rejects with `Error` on failure.

**Important Implementation Notes:**
- Do **not** manually set `Content-Type` header for multipart: the browser will set the correct `boundary` value.
- Use `xhr.upload.onprogress` and check `evt.lengthComputable` to compute percent.
- Attempt `JSON.parse` on response; fallback to raw text if parsing fails.

**Example:**
```js
await sendFormData(form, {
  url: 'http://localhost:8001/app/records',
  authToken: 'Bearer ...',
  onProgress: p => console.log('Upload progress', p)
});
```

---

### `fetchLatestFileAsFile()` (app.js helper)

**Signature:** `export async function fetchLatestFileAsFile() -> Promise<File|null>`

**Purpose:** Fetches metadata from `/latest-file`, retrieves the latest file from the URL provided in the metadata, and returns it as a `File` instance to be appended as `attachment` to a `FormData` (used for auto-attach feature).

**Behavior:** Performs `GET /latest-file` → expects JSON `{ name, url, ... }` → fetch the `url` → create `Blob` → convert to `File` with `name`. Returns `null` if no file or on non-fatal errors.

**Example:**
```js
const auto = await fetchLatestFileAsFile();
if (auto) form.append('attachment', auto, auto.name);
```

---

## `model.js` — `CameraModel` Class (Detailed)

**Purpose:** Provides an abstraction over browser `MediaDevices` apps to enumerate cameras, open/close media streams, and perform initial dual-pane setup for left/right camera views.

**Definition Overview:**
```js
export class CameraModel {
  constructor() { this.stream = null; this.devices = []; }
  async enumerate();
  async open(deviceId);
  close();
  static async init(left, right);
}
```

### `constructor()`
Initializes internal state:
- `this.stream` — `MediaStream | null`
- `this.devices` — `Array<MediaDeviceInfo>`

### `async enumerate()`
- Verifies `navigator.mediaDevices` availability; if absent, throws `Error`.
- Calls `navigator.mediaDevices.enumerateDevices()` and filters to `kind === 'videoinput'`.
- Populates `this.devices` and returns the array.

**Notes:** Some browsers hide `label` until a media permission is granted. Consider requesting a temporary `getUserMedia` to reveal labels if necessary.

### `async open(deviceId)`
- If a previous stream exists, calls `this.close()` to stop tracks.
- Calls `navigator.mediaDevices.getUserMedia()` with constraints: `{ video: { deviceId: { exact: deviceId } } }` if `deviceId` provided, else `{ video: true }`.
- Stores and returns the obtained `MediaStream`.

**Errors:** Propagates errors from `getUserMedia` (e.g., `NotAllowedError`, `NotFoundError`) to callers. UI should catch and display appropriate messages to users.

### `close()`
- Stops all tracks on the current `MediaStream` and sets `this.stream = null`.

### `static async init(left, right)`
- Performs dynamic import of the `CameraModel` class (to reduce circular import problems).
- Enumerates devices and, if labels are hidden, requests a temporary `getUserMedia` to obtain labels and then stops that temporary stream.
- Populates left and right views via `left.view.fillDevices(devices)` and `right.view.fillDevices(devices)` and sets preferred device indices (using a helper `pickPreferredIndices(devices)` which should be defined in `deviceUtils.js`).
- Sets `data-pref-device-id` attributes on view roots to persist preferred devices across interactions.

**Usage Example:**
```js
await CameraModel.init(leftPane, rightPane);
```

---

## HTTP app Contract (Server Expectations)

- **Endpoint (upload):** `POST /app/records`
- **Content-Type:** `multipart/form-data` (browser assigns boundary)
- **Form fields:** `patientId` (required), `patientName`, `patientAge`, `description`, `timestamp`, `attachment` (optional, single), `leftImages` (multiple), `rightImages` (multiple)
- **Success response:** `200 OK` with JSON body, e.g.:
```json
{ "ok": true, "patientId": "P001", "saved": { "folder": "data/P001/", "files": [...], "meta": "data/P001/metadata.json" }, "message": "Record saved" }
```
- **Client-side requirements:** Do not set `Content-Type` manually when sending `FormData`. Support CORS if client and server are on different origins (`Access-Control-Allow-Origin`, etc.).

### Server Storage Recommendation
- Store records under a base directory like `./data/records/`. For each `patientId`, create a folder `./data/records/<patientId>/`.
- Save files using server-generated safe filenames (avoid using raw client-supplied filenames without sanitization).
- Maintain `metadata.json` inside the patient folder with structured information about the record and files.

---

## Security, Compatibility, and Performance Notes

- **Security:** Validate and sanitize `patientId`. Avoid directory traversal vulnerabilities. Authorize uploads if sensitive. Consider authentication (JWT/session).
- **CORS:** Configure server headers when client and server are on different origins.
- **File size limits:** Enforce a maximum upload size on server-side (e.g., 20–50MB) and provide client-side checks to improve user experience.
- **Browser compatibility:** Test `getUserMedia` and `enumerateDevices` across supported browsers. Use graceful degradation where necessary.
- **Performance:** Resize/compress images in the browser where feasible to reduce upload times and server storage.

---

## Example Save Flow (Client-side)

1. User enters `patientId` and optional name/age/notes.
2. User captures images for left/right and optionally selects an attachment file.
3. Optionally call `fetchLatestFileAsFile()` to auto-attach the latest server file.
4. Call `buildFormDataFromUI()` to construct `FormData`.
5. Call `sendFormData(form, {...})` to upload. Handle `onProgress` updates and final response.

---

## Troubleshooting Tips

- **400 Bad Request:** Inspect server response body for validation error messages (e.g., missing `patientId`). Print response text to console for debugging.
- **CORS errors:** Ensure server sets `Access-Control-Allow-Origin` and allows `Content-Type` and `Authorization` if used.
- **No device labels returned from `enumerateDevices()`:** Prompt for camera permissions using a temporary `getUserMedia` call before enumerating again.
- **Files not uploaded:** Verify that `FormData` contains the expected fields by logging entries on the client before sending:
```js
for (const [k, v] of form.entries()) {
  console.log(k, v instanceof File ? v.name : v);
}
```

---

## Suggested Improvements & Roadmap

- Split `uploadRecord()` into separate `buildFormDataFromUI()` and `sendFormData()` functions for single responsibility and testability.
- Add unit tests for `utils` using mocked DOM inputs and file objects.
- Add server-side authorization and per-user access control for records.
- Provide a small CLI or admin UI for browsing saved patient records and downloading metadata.

---

## License & Contribution

This documentation is provided as a starting point for project development. When adding code to a public repository (GitHub), include an appropriate license (e.g., MIT) and a CONTRIBUTING.md that describes how to test and extend the modules.

---

*If you want, I can also produce a `README.md` that includes smaller code snippets for each function inline, or convert the above into separate `docs/*.md` files for modular documentation.*
