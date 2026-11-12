#!/bin/zsh
# 연락 메일 바꾸기: make contact EMAIL=new@example.com
# CONTACT 한 곳이 기준이다. 저장소 문서(README·PRIVACY)의 옛 주소를 새 주소로 바꾸고 CONTACT를 고친다.
# 앱은 다음 빌드 때 CONTACT를 읽고(빌드 설정에 넣어 둔 경우), 다른 저장소의 사이트는 다음 배포 때 GitHub의 CONTACT를 읽는다.
# git 밖(.env·.dev.vars 같은 무시된 파일)과 호스팅 환경 값은 바꾸지 않고, 옛 주소가 든 파일과 키 이름만 끝에 알린다(값은 안 찍음).
set -eu
cd "$(dirname "$0")/.."
NEW="${1:?새 주소를 주세요: make contact EMAIL=new@example.com}"
[[ "$NEW" == *@*.* ]] || { echo "메일 주소가 아니에요: $NEW"; exit 1; }
OLD=$(head -1 CONTACT)
[ "$OLD" = "$NEW" ] && { echo "이미 $NEW"; exit 0; }
# -z + (0): 띄어쓰기·한글이 든 파일 이름도 한 덩이로(git이 따옴표로 감싸지 않게)
for f in ${(0)"$(git grep -l -z -F "$OLD" -- ':!CONTACT')"}; do
  python3 -c 'import sys;p,o,n=sys.argv[1:];s=open(p,encoding="utf-8").read();open(p,"w",encoding="utf-8").write(s.replace(o,n))' "$f" "$OLD" "$NEW"
  echo "고침: $f"
done
print -r -- "$NEW" > CONTACT
echo "CONTACT: $OLD → $NEW  (커밋·푸시하면 사이트는 다음 배포에, 앱은 다음 빌드에 반영)"
left=()
for f in ${(0)"$(git ls-files -z --others --ignored --exclude-standard -- ':(glob)**/.env*' ':(glob)**/*.vars' ':(glob)**/*.env')"}; do
  [ -f "$f" ] && grep -qF -- "$OLD" "$f" 2>/dev/null || continue
  keys=$(grep -F -- "$OLD" "$f" | sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*[=:].*/\2/p' | sort -u | paste -sd, -)
  left+=("$f${keys:+ ($keys)}")
done
if (( ${#left} )); then
  echo "손으로 — git 밖이라 안 바꾼 곳(값은 안 찍음):"
  for x in $left; do echo "  $x"; done
fi
echo "호스팅 환경 값(Vercel·Cloudflare·GitHub Secrets 등, 예: VAPID subject·사업자 메일)에 옛 주소가 있으면 거기서도 손으로."
