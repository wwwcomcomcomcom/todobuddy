/// GitHub Releases 를 통해 업데이트를 확인할 저장소.
/// `web/lib/site.ts` 의 `NEXT_PUBLIC_GITHUB_REPO` 기본값과 같은 저장소를 가리켜야 한다.
const String kGithubRepoSlug = 'wwwcomcomcomcom/todobuddy';

/// 지금 실행 중인 앱의 버전. 릴리스 빌드 시 `--dart-define=TODOBUDDY_APP_VERSION=...` 로
/// pubspec.yaml 의 버전이 그대로 들어온다 (build_macos.sh, desktop-build.yml 참고).
/// 넘어오지 않으면(로컬 디버그 실행) 항상 업데이트가 있다고 나오지 않도록 임의로 낮은 값을 쓰지
/// 않고, 대신 업데이트 확인 자체가 무의미하니 비교에서 걸러낼 수 있는 표식을 쓴다.
const String kCurrentAppVersion =
    String.fromEnvironment('TODOBUDDY_APP_VERSION', defaultValue: '0.0.0-dev');
