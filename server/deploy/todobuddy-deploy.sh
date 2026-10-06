#!/usr/bin/env bash
# 운영 서버 배포. self-hosted 러너(github-runner 계정)가 `sudo -H -u ubuntu` 로 부른다.
#
#   todobuddy-deploy v0.3.0
#
# 운영 서버에는 /usr/local/bin/todobuddy-deploy 로 root 소유로 깔아 둔다.
# 러너가 이 파일을 고칠 수 없어야 러너가 할 수 있는 일이 "origin 의 태그를 배포" 하나로 묶인다.
# 그래서 저장소의 이 파일을 고쳐도 자동으로 반영되지 않는다. 고쳤으면 직접 다시 깔 것.
set -euo pipefail

REPO_DIR=/home/ubuntu/todobuddy
DB="$REPO_DIR/server/data/todobuddy.db"
BACKUP_DIR=/home/ubuntu/todobuddy-backups
KEEP_BACKUPS=30
SERVICE=todobuddy-server
NODE_BIN=/home/ubuntu/.nvm/versions/node/v24.21.0/bin

export HOME=/home/ubuntu
export PATH="$NODE_BIN:/usr/local/bin:/usr/bin:/bin"

TAG="${1:-}"
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "태그 형식이 아니다 (vX.Y.Z): '$TAG'" >&2
  exit 2
fi
if [[ "$(id -un)" != ubuntu ]]; then
  echo "ubuntu 계정으로 실행해야 한다" >&2
  exit 2
fi

exec 9>"$HOME/.todobuddy-deploy.lock"
flock -n 9 || { echo "다른 배포가 진행 중이다" >&2; exit 1; }

cd "$REPO_DIR"
git fetch -q --tags origin
NEXT=$(git rev-parse -q --verify "refs/tags/$TAG^{commit}") || { echo "origin 에 $TAG 태그가 없다" >&2; exit 1; }
PREV=$(git rev-parse HEAD)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "운영 체크아웃에 커밋 안 된 변경이 있다. 정리한 뒤 다시 돌릴 것" >&2
  git status --short >&2
  exit 1
fi

PORT=$(sed -n 's/^PORT=//p' server/.env 2>/dev/null | tail -1)
HEALTH_URL="http://127.0.0.1:${PORT:-4000}/health"

echo "== $TAG 배포: ${PREV:0:7} → ${NEXT:0:7}"

# 서버가 돌고 있는 채로 일관된 스냅샷을 뜬다 (WAL 이라 파일 복사로는 안 된다).
# 마이그레이션은 추가만 하므로 롤백할 때 DB 를 되돌리지는 않는다. 필요하면 이 스냅샷을 쓴다.
mkdir -p "$BACKUP_DIR"
if [[ -f "$DB" ]]; then
  SNAP="$BACKUP_DIR/todobuddy-$(date +%Y%m%d-%H%M%S)-${PREV:0:7}.db"
  node -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1]);
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare("VACUUM INTO ?").run(process.argv[2]);
    db.close();
  ' "$DB" "$SNAP"
  echo "== DB 스냅샷: $SNAP"
  ls -1t "$BACKUP_DIR"/todobuddy-*.db | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
fi

deps_changed() {
  ! git diff --quiet "$1" "$2" -- package-lock.json package.json server/package.json
}

# web 이 같은 체크아웃의 node_modules 를 쓰며 돌고 있으므로 npm ci (전부 지우고 새로 깔기) 는 쓰지 않는다.
install_deps() {
  npm install --no-audit --no-fund
  git checkout -q -- package-lock.json
}

healthy() {
  for _ in $(seq 1 30); do
    curl -fsS -m 2 "$HEALTH_URL" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  return 1
}

git checkout -q --detach "$NEXT"
if deps_changed "$PREV" "$NEXT"; then
  echo "== 의존성이 바뀌어 npm install"
  install_deps
fi

sudo -n systemctl restart "$SERVICE"
if healthy; then
  echo "== 배포 완료: $TAG (${NEXT:0:7})"
  exit 0
fi

echo "== 헬스체크 실패. ${PREV:0:7} 로 되돌린다" >&2
sudo -n journalctl -u "$SERVICE" -n 40 --no-pager >&2 || true
git checkout -q --detach "$PREV"
if deps_changed "$PREV" "$NEXT"; then
  install_deps
fi
sudo -n systemctl restart "$SERVICE"
if healthy; then
  echo "== 롤백 완료. 서버는 ${PREV:0:7} 로 돌고 있다" >&2
else
  echo "== 롤백 후에도 헬스체크 실패. 직접 확인할 것: journalctl -u $SERVICE" >&2
fi
exit 1
