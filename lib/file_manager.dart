// file_manager.dart
// FileManager with patient-specific directories and robust path resolution for web URIs.
// Fixed: no escaped '\$' sequences; uses proper string concatenation/interpolation.
import 'dart:io';
import 'dart:convert';
import 'utils.dart';

class FileManager {
  final Directory root;
  FileManager(this.root);

  /// Ensure the root directory exists.
  Future<void> ensureRoot() async {
    if (!await root.exists()) await root.create(recursive: true);
  }

  /// Return list of files (not directories) under the root directory (non-recursive).
  Future<List<File>> listFiles({List<String>? extensions}) async {
    if (!await root.exists()) return <File>[];
    final entries = await root.list().toList();
    var files = entries.whereType<File>().toList();
    if (extensions == null || extensions.isEmpty) return files;
    final low = extensions.map((e) => e.toLowerCase()).toSet();
    return files.where((f) {
      final ext = _extOf(f.uri.pathSegments.last);
      return ext.isNotEmpty && low.contains(ext.toLowerCase());
    }).toList();
  }

  /// Return the newest file (by modified time) or null if none.
  Future<File?> latestFile({List<String>? extensions}) async {
    final files = await listFiles(extensions: extensions);
    if (files.isEmpty) return null;
    files.sort((a, b) => b.statSync().modified.compareTo(a.statSync().modified));
    return files.first;
  }

  /// Validate a client-supplied filename segment (no traversal, no separators).
  bool _isValidSegment(String seg) {
    return !(seg == '..' || seg.contains(Platform.pathSeparator) || seg.contains('/') || seg.contains('\\') || seg.isEmpty);
  }

  /// Resolve a web URI path (like '/index.html' or '/assets/img.png') to a File under root.
  /// This method decodes percent-encoding, validates each path segment, and prevents traversal.
  /// If the path points to a directory, it will return the index.html inside that directory if exists.
  /// Returns null if the path is invalid or file doesn't exist.
  File? fileForUriPath(String uriPath) {
    // Normalize and decode using Uri to handle percent-encoding
    final cleaned = uriPath.split('?').first.split('#').first;
    final uri = Uri(path: cleaned);
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();

    // If empty, serve index.html at root
    if (segments.isEmpty) {
      final f = File(joinPath('index.html'));
      return f;
    }

    // Validate segments
    if (!segments.every(_isValidSegment)) return null;

    // Build filesystem path
    final fsPath = segments.join(Platform.pathSeparator);
    final candidate = File(joinPath(fsPath));

    // If candidate is a directory, try index.html inside it
    if (candidate.existsSync() && candidate.statSync().type == FileSystemEntityType.directory) {
      final idx = File(candidate.path + Platform.pathSeparator + 'index.html');
      if (idx.existsSync()) return idx;
      return null;
    }

    return candidate;
  }

  /// Join root path and filename safely (input should be validated by isValidRelativePath).
  String joinPath(String name) {
    if (root.path.endsWith(Platform.pathSeparator)) return root.path + name;
    return root.path + Platform.pathSeparator + name;
  }

  /// Ensure an uploads directory exists under root and return its Directory object.
  Future<Directory> ensureUploadsDir([String uploadsDirName = 'uploads']) async {
    final upl = Directory(joinPath(uploadsDirName));
    if (!await upl.exists()) await upl.create(recursive: true);
    return upl;
  }

  /// Ensure a patient directory exists under root/patients/<patientId> and return it.
  Future<Directory> ensurePatientDir(String patientId) async {
    final safeId = sanitizeFilename(patientId);
    final patientsRoot = Directory(joinPath('patients'));
    if (!await patientsRoot.exists()) await patientsRoot.create(recursive: true);
    final patientDirPath = patientsRoot.path + Platform.pathSeparator + safeId;
    final patientDir = Directory(patientDirPath);
    if (!await patientDir.exists()) await patientDir.create(recursive: true);
    return patientDir;
  }

  /// Ensure uploads directory for a given patient and return it.
  Future<Directory> ensurePatientUploadsDir(String patientId, [String uploadsDirName = 'uploads']) async {
    final pd = await ensurePatientDir(patientId);
    final uploads = Directory(pd.path + Platform.pathSeparator + uploadsDirName);
    if (!await uploads.exists()) await uploads.create(recursive: true);
    return uploads;
  }

  /// Write the patient record (JSON) into the patient's folder. Also creates a timestamped copy.
  Future<bool> writePatientRecord(String patientId, Map<String, dynamic> record) async {
    try {
      final pd = await ensurePatientDir(patientId);
      final mainFile = File(pd.path + Platform.pathSeparator + 'record.json');
      await mainFile.writeAsString(jsonEncode(record), flush: true);
      final timestamped = File(pd.path + Platform.pathSeparator + 'record_' + DateTime.now().millisecondsSinceEpoch.toString() + '.json');
      await timestamped.writeAsString(jsonEncode(record), flush: true);
      return true;
    } catch (e) {
      stderr.writeln('Error writing patient record for ' + patientId + ': ' + e.toString());
      return false;
    }
  }

  String _extOf(String name) {
    final i = name.lastIndexOf('.');
    if (i < 0) return '';
    return name.substring(i + 1);
  }
}
