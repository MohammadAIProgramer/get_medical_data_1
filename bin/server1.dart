import 'dart:io';
import '../lib/file_manager.dart';
import '../lib/request_router.dart';

void main(List<String> args) async {
  final dirPath = "./"; //args.isNotEmpty ? args[0] : Directory.current.path;
  final latestFilePath = File("./path.txt").readAsStringSync();
  final port = args.length > 1 ? int.tryParse(args[1]) ?? 8001 : 8001;
  final exts = args.length > 2 ? args[2].split(',').map((s) => s.trim().toLowerCase()).toList() : <String>[];

  final fm = FileManager(Directory(latestFilePath));
  await fm.ensureRoot();

  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  print('Server listening on http://${server.address.address}:$port, serving: $dirPath');

  final router = RequestRouter(fm, port: port);

  await for (final req in server) {
    router.handle(req);
  }
}
