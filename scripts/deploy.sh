#!/bin/zsh
# out/(정적 빌드)을 gh-pages 브랜치로 강제 push한다. 데이터 JSON이 매일 바뀌므로 이력은 남기지 않는다(저장소 비대 방지).
set -euo pipefail
root="${0:A:h:h}" # 임시 폴더로 옮겨 가기 전에 저장소 경로를 잡아 둔다
cd "$root"
remote=$(git remote get-url origin)
[[ -f out/index.html ]] || { echo "out/이 없습니다. npx next build 먼저"; exit 1; }
touch out/.nojekyll # _next 폴더를 Jekyll이 숨기지 않게
tmp=$(mktemp -d)
cp -R out/. "$tmp"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$root" config user.name)" -c user.email="$(git -C "$root" config user.email)" \
  commit -q -m "Deploy $(date '+%F %T')"
git push -q -f "$remote" gh-pages
cd - >/dev/null
rm -rf "$tmp"
echo "배포 완료: gh-pages"
