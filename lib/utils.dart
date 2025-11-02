// utils.dart
// Small helper utilities extracted to reduce duplication.
// Fixed: no escaped '$' characters.
import 'dart:io';
import 'dart:convert';

/// Return a ContentType for a filename based on extension.
ContentType contentTypeForFilename(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return ContentType('text', 'html', charset: 'utf-8');
  } else if (lower.endsWith('.css')) {
    return ContentType('text', 'css', charset: 'utf-8');
  } else if (lower.endsWith('.js')) {
    return ContentType('application', 'javascript', charset: 'utf-8');
  } else if (lower.endsWith('.json')) {
    return ContentType.json;
  } else if (lower.endsWith('.pdf')) {
    return ContentType('application', 'pdf');
  } else if (lower.endsWith('.png')) {
    return ContentType('image', 'png');
  } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return ContentType('image', 'jpeg');
  } else if (lower.endsWith('.svg')) {
    return ContentType('image', 'svg+xml');
  } else if (lower.endsWith('.txt')) {
    return ContentType.text;
  } else {
    return ContentType.binary;
  }
}

/// Sanitize a filename by replacing unsafe characters.
String sanitizeFilename(String name) {
  return name.replaceAll(RegExp(r'[^a-zA-Z0-9_\-\.]'), '');
}

/// Write JSON response and close.
Future<void> writeJson(HttpResponse res, Object obj, {int status = 200}) async {
  try {
    res.statusCode = status;
    res.headers.contentType = ContentType.json;
    res.write(jsonEncode(obj));
    await res.close();
  } catch (_) {
    try { await res.close(); } catch (_) {}
  }
}

/// Write a plain text error response.
Future<void> sendTextError(HttpResponse res, int status, String message) async {
  try {
    res.statusCode = status;
    res.headers.contentType = ContentType.text;
    res.write(message);
    await res.close();
  } catch (_) {
    try { await res.close(); } catch (_) {}
  }
}

/// Attempt to safely write file stream to disk using given path.
Future<bool> writeFileFromBytes(String path, List<int> bytes) async {
  try {
    final f = File(path);
    await f.writeAsBytes(bytes, flush: true);
    return true;
  } catch (e) {
    stderr.writeln('Failed writing file ' + path + ': ' + e.toString());
    return false;
  }
}
