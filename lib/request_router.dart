// request_router.dart
// RequestRouter handles routing, CORS, static serving and uploads.
import 'dart:io';
import 'dart:convert';
import 'file_manager.dart';
import 'utils.dart';

class RequestRouter {
  final FileManager fm;
  final int port;
  HttpServer? _server;

  RequestRouter(this.fm, {this.port = 8001});

  void _setCorsHeaders(HttpResponse res) {
    final headers = res.headers;
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  Future<void> handle(HttpRequest req) async {
    try {
      // Preflight & CORS: respond fast for OPTIONS
      if (req.method == 'OPTIONS') {
        _setCorsHeaders(req.response);
        try { req.response.statusCode = HttpStatus.ok; await req.response.close(); } catch (_) {}
        return;
      }

      // Set CORS for other responses too
      _setCorsHeaders(req.response);

      final path = req.uri.path;
      if (req.method == 'POST' && path == '/api/records') {
        await _handleUpload(req);
        return;
      }

      if (path == '/latest-file') {
        await _handleLatestFile(req);
        return;
      }

      if (path.startsWith('/files/')) {
        final enc = path.substring('/files/'.length);
        await _handleFileRequest(req, enc);
        return;
      }

      if (path == '/list') {
        final q = req.uri.queryParameters['ext'];
        final exts = q == null || q.trim().isEmpty ? <String>[] : q.split(',').map((s) => s.toLowerCase()).toList();
        await _handleList(req, exts);
        return;
      }

      // default: static file serve
      await _serveStatic(req);
    } catch (e, st) {
      stderr.writeln('Router error: ' + e.toString() + '\n' + st.toString());
      await sendTextError(req.response, HttpStatus.internalServerError, 'Internal server error');
    }
  }

  Future<void> _serveStatic(HttpRequest req) async {
    final rawPath = req.uri.path;
    final file = fm.fileForUriPath(rawPath) ?? fm.fileForUriPath('/index.html');
    if (file == null || !await file.exists()) {
      await sendTextError(req.response, HttpStatus.notFound, 'File not found: ' + rawPath);
      return;
    }
    req.response.headers.contentType = contentTypeForFilename(file.path);
    try {
      await req.response.addStream(file.openRead());
    } catch (e, st) {
      stderr.writeln('Static serve error: ' + e.toString() + '\n' + st.toString());
      await sendTextError(req.response, HttpStatus.internalServerError, 'Error serving file');
    } finally {
      try { await req.response.close(); } catch (_) {}
    }
  }

  Future<void> _handleLatestFile(HttpRequest req) async {
    final latest = await fm.latestFile();
    if (latest == null) {
      await sendTextError(req.response, HttpStatus.notFound, 'No files found');
      return;
    }
    final stat = latest.statSync();
    final name = latest.uri.pathSegments.last;
    final url = 'http://localhost:' + port.toString() + '/files/' + Uri.encodeComponent(name);
    await writeJson(req.response, {'name': name, 'url': url, 'mtime': stat.modified.toIso8601String(), 'size': stat.size});
  }

  Future<void> _handleList(HttpRequest req, List<String> exts) async {
    final files = await fm.listFiles(extensions: exts.isEmpty ? null : exts);
    final list = files.map((f) {
      final s = f.statSync();
      return {'name': f.uri.pathSegments.last, 'mtime': s.modified.toIso8601String(), 'size': s.size};
    }).toList();
    await writeJson(req.response, {'files': list});
  }

  Future<void> _handleFileRequest(HttpRequest req, String encodedName) async {
    final name = Uri.decodeComponent(encodedName);
    final file = fm.fileForUriPath(name);
    if (file == null || !await file.exists()) {
      await sendTextError(req.response, HttpStatus.notFound, 'File not found: ' + name);
      return;
    }
    req.response.headers.contentType = contentTypeForFilename(file.path);
    try {
      await req.response.addStream(file.openRead());
    } catch (e, st) {
      stderr.writeln('Error streaming file ' + name + ': ' + e.toString() + '\n' + st.toString());
      await sendTextError(req.response, HttpStatus.internalServerError, 'Error streaming file');
    } finally {
      try { await req.response.close(); } catch (_) {}
    }
  }

  // Manual multipart parser; stores files under patients/<patientId>/uploads and writes record.json
  Future<void> _handleUpload(HttpRequest req) async {
    final contentType = req.headers.contentType;
    if (contentType == null || contentType.mimeType != 'multipart/form-data') {
      await sendTextError(req.response, HttpStatus.badRequest, 'Expected multipart/form-data');
      return;
    }
    final boundary = contentType.parameters['boundary'];
    if (boundary == null || boundary.isEmpty) {
      await sendTextError(req.response, HttpStatus.badRequest, 'Missing boundary');
      return;
    }

    // read body into memory
    final bb = BytesBuilder();
    await for (var chunk in req) bb.add(chunk);
    final bodyBytes = bb.takeBytes();
    final bodyStr = latin1.decode(bodyBytes);
    final sep = '--' + boundary;

    final formFields = <String, String>{};
    final filesInfo = <String, List<Map<String, String>>>{};

    final parts = bodyStr.split(sep);
    for (var rawPart in parts) {
      if (rawPart.trim().isEmpty) continue;
      var part = rawPart;
      if (part.trim() == '--') continue;
      if (part.startsWith('\r\n')) part = part.substring(2);
      final headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd < 0) continue;
      final headersText = part.substring(0, headerEnd);
      var content = part.substring(headerEnd + 4);
      if (content.endsWith('\r\n')) content = content.substring(0, content.length - 2);

      final headersLines = headersText.split('\r\n');
      String? contentDisposition;
      String? contentTypeHeader;
      for (var h in headersLines) {
        final idx = h.indexOf(':');
        if (idx < 0) continue;
        final name = h.substring(0, idx).trim().toLowerCase();
        final value = h.substring(idx + 1).trim();
        if (name == 'content-disposition') contentDisposition = value;
        if (name == 'content-type') contentTypeHeader = value;
      }
      if (contentDisposition == null) continue;
      final nameMatch = RegExp(r'name="([^"]+)"').firstMatch(contentDisposition);
      final fieldName = nameMatch != null ? nameMatch.group(1) : null;
      final filenameMatch = RegExp(r'filename="([^\\"]*)"').firstMatch(contentDisposition);
      final filename = filenameMatch != null ? filenameMatch.group(1) : null;

      if (filename == null || filename.isEmpty) {
        final value = utf8.decode(latin1.encode(content));
        if (fieldName != null) formFields[fieldName] = value;
      } else {
        final bytes = latin1.encode(content);
        filesInfo.putIfAbsent(fieldName ?? 'file', () => []).add({
          'originalName': filename,
          'bytes': base64.encode(bytes),
          'contentType': contentTypeHeader ?? ''
        });
      }
    }

    final pid = formFields['patientId'] ?? formFields['patientID'] ?? formFields['patient_id'];
    if (pid == null || pid.trim().isEmpty) {
      await sendTextError(req.response, HttpStatus.badRequest, 'Missing patientId field');
      return;
    }
    final patientId = pid.trim();

    final uploadsDir = await fm.ensurePatientUploadsDir(patientId);

    final storedFilesInfo = <String, List<Map<String, String>>>{};
    for (var entry in filesInfo.entries) {
      final key = entry.key;
      for (var item in entry.value) {
        final original = item['originalName'] ?? 'file';
        final b64 = item['bytes'] ?? '';
        final bytes = base64.decode(b64);
        final safe = sanitizeFilename(original);
        final storedName = DateTime.now().millisecondsSinceEpoch.toString() + '_' + safe;
        final filePath = uploadsDir.path + Platform.pathSeparator + storedName;
        final ok = await writeFileFromBytes(filePath, bytes);
        if (ok) {
          storedFilesInfo.putIfAbsent(key, () => []).add({
            'originalName': original,
            'storedName': storedName,
            'path': filePath
          });
        }
      }
    }

    final record = {
      'fields': formFields,
      'files': storedFilesInfo,
      'timestamp': DateTime.now().toIso8601String()
    };

    final wrote = await fm.writePatientRecord(patientId, record);

    await writeJson(req.response, {'ok': true, 'wroteRecord': wrote, 'record': record});
  }
}
