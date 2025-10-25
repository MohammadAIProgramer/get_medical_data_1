// app_server.dart
// Binds the HttpServer and delegates requests to RequestRouter.
import 'dart:io';
import 'file_manager.dart';
import 'request_router.dart';

void main(List<String> args) async {
  // If a root path is provided, use it. Otherwise use Directory.current.path.
  final dirPath = args.isNotEmpty ? args[0] : Directory.current.path;
  final port = args.length > 1 ? int.tryParse(args[1]) ?? 8001 : 8001;

  final fm = FileManager(Directory(dirPath));
  await fm.ensureRoot();

  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  print('Server listening on http://' + server.address.address + ':' + port.toString() + ', serving: ' + dirPath);

  final router = RequestRouter(fm, port: port);

  await for (final req in server) {
    router.handle(req);
  }
}
