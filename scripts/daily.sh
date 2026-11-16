#!/bin/zsh
# 매일 실행: 수집 → MySQL 적재 → 진행 중 공매 예측 → JSON 내보내기 → 정적 빌드 → (저장소가 있으면) GitHub Pages 배포
# launchd(~/Library/LaunchAgents/com.nopgae.used-car-compare.plist)가 부른다. 직접 실행해도 된다.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}/.."
mkdir -p logs
exec >> "logs/daily-$(date +%Y%m%d).log" 2>&1
echo "=== $(date '+%F %T') 시작"

# 맥이 자고 나면 Docker가 꺼져 있을 수 있다
if ! docker info >/dev/null 2>&1; then
  open -a Docker
  for _ in {1..60}; do docker info >/dev/null 2>&1 && break; sleep 3; done
fi
docker compose up -d
for _ in {1..60}; do docker compose exec -T mysql sh -c 'mysqladmin ping -uapp -p"$MYSQL_PASSWORD" --silent' 2>/dev/null && break; sleep 2; done

# 며칠 못 돌아도 메워지도록 최근 2~3개월을 다시 받는다(upsert라 중복 없음)
npm run ingest -- "$(date -v-2m +%Y-%m)"
npm run ingest:stats -- "$(date -v-3m +%Y-%m)"
npm run snapshot
npm run export
npx next build

if git remote get-url origin >/dev/null 2>&1; then
  scripts/deploy.sh
fi
echo "=== $(date '+%F %T') 끝"
