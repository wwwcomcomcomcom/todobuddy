import 'dart:io';

import 'package:http/http.dart' as http;

import 'update_checker.dart';

/// 새 버전을 내려받아 지금 실행 중인 설치를 교체하고 재실행한다.
///
/// 사용자가 명시적으로 누른 동작이므로 실패하면 예외를 그대로 던져 호출부(다이얼로그)가
/// 보여줄 수 있게 한다. 성공하면 실제 교체는 별도로 띄운 헬퍼 스크립트가 하고, 이 앱
/// 프로세스는 `exit(0)` 으로 즉시 종료된다 — 즉, 성공 시 이 메서드는 정상적으로 리턴하지 않는다.
class UpdateInstaller {
  UpdateInstaller({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<void> downloadAndInstall(UpdateInfo info, {void Function(double progress)? onProgress}) async {
    final tempDir = await Directory.systemTemp.createTemp('todobuddy-update-');
    try {
      final zipPath = '${tempDir.path}${Platform.pathSeparator}update.zip';
      await _download(Uri.parse(info.downloadUrl), File(zipPath), onProgress);

      final extractDir = Directory('${tempDir.path}${Platform.pathSeparator}extracted');
      await extractDir.create();
      await _extract(zipPath, extractDir.path);

      if (Platform.isMacOS) {
        await _installMacOS(extractDir, tempDir);
      } else if (Platform.isWindows) {
        await _installWindows(extractDir, tempDir);
      } else {
        throw UnsupportedError('지원하지 않는 플랫폼이에요.');
      }
    } catch (_) {
      await tempDir.delete(recursive: true).catchError((_) => tempDir);
      rethrow;
    }
  }

  Future<void> _download(Uri uri, File destination, void Function(double progress)? onProgress) async {
    final response = await _client.send(http.Request('GET', uri));
    if (response.statusCode != 200) {
      throw StateError('다운로드 실패: HTTP ${response.statusCode}');
    }

    final total = response.contentLength;
    var received = 0;
    final sink = destination.openWrite();
    await response.stream.listen((chunk) {
      received += chunk.length;
      sink.add(chunk);
      if (total != null && total > 0) onProgress?.call(received / total);
    }).asFuture<void>();
    await sink.close();
  }

  Future<void> _extract(String zipPath, String destDir) async {
    final ProcessResult result;
    if (Platform.isMacOS) {
      // build_macos.sh 가 ditto 로 압축한 것과 짝을 맞춘다 — 일반 unzip 은 심볼릭 링크·
      // 확장 속성을 깨뜨려 서명을 망가뜨릴 수 있다.
      result = await Process.run('ditto', ['-x', '-k', zipPath, destDir]);
    } else {
      result = await Process.run('powershell', [
        '-NoProfile',
        '-Command',
        "Expand-Archive -LiteralPath '$zipPath' -DestinationPath '$destDir' -Force",
      ]);
    }
    if (result.exitCode != 0) {
      throw StateError('압축 해제 실패: ${result.stderr}');
    }
  }

  Future<void> _installMacOS(Directory extractDir, Directory tempDir) async {
    final appBundle = await _findAppBundle(extractDir);
    if (appBundle == null) throw StateError('내려받은 파일에서 앱을 찾지 못했어요.');

    // Todo Buddy.app/Contents/MacOS/Todo Buddy → 3단계 위가 번들 루트.
    final installedApp = File(Platform.resolvedExecutable).parent.parent.parent.path;

    final scriptPath = '${tempDir.path}${Platform.pathSeparator}update_helper.sh';
    const script = '''
#!/bin/bash
PID="\$1"; OLD_APP="\$2"; NEW_APP="\$3"; TEMP_DIR="\$4"
while kill -0 "\$PID" 2>/dev/null; do sleep 0.5; done
rm -rf "\$OLD_APP"
ditto "\$NEW_APP" "\$OLD_APP"
xattr -dr com.apple.quarantine "\$OLD_APP" 2>/dev/null || true
open "\$OLD_APP"
rm -rf "\$TEMP_DIR"
''';
    await File(scriptPath).writeAsString(script);
    await Process.run('chmod', ['+x', scriptPath]);

    await Process.start(
      '/bin/bash',
      [scriptPath, pid.toString(), installedApp, appBundle.path, tempDir.path],
      mode: ProcessStartMode.detached,
    );
    exit(0);
  }

  Future<void> _installWindows(Directory extractDir, Directory tempDir) async {
    final currentExe = File(Platform.resolvedExecutable);
    final installDir = currentExe.parent.path;
    final exeName = currentExe.path.substring(currentExe.path.lastIndexOf(Platform.pathSeparator) + 1);

    final scriptPath = '${tempDir.path}${Platform.pathSeparator}update_helper.ps1';
    const script = '''
param(\$ProcId, \$OldDir, \$NewDir, \$ExeName, \$TempDir)
while (Get-Process -Id \$ProcId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }
Copy-Item -Path (Join-Path \$NewDir '*') -Destination \$OldDir -Recurse -Force
Start-Process -FilePath (Join-Path \$OldDir \$ExeName)
Start-Sleep -Milliseconds 500
Remove-Item -Recurse -Force \$TempDir
''';
    await File(scriptPath).writeAsString(script);

    await Process.start(
      'powershell',
      [
        '-NoProfile',
        '-WindowStyle',
        'Hidden',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        pid.toString(),
        installDir,
        extractDir.path,
        exeName,
        tempDir.path,
      ],
      mode: ProcessStartMode.detached,
    );
    exit(0);
  }

  Future<Directory?> _findAppBundle(Directory root) async {
    await for (final entity in root.list(recursive: true)) {
      if (entity is Directory && entity.path.endsWith('.app')) return entity;
    }
    return null;
  }
}
