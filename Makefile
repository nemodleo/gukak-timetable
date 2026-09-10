# 강사·강의실 시간표 — 개발 / 시드 / 배포 단축 명령
#
#   make            도움말
#   make setup      의존성 설치 (npm + python venv)
#   make dev        개발 서버
#   make seed       data/*.xlsx → src/data/seed-2026.json 재생성
#   make test       vitest + 파서 파이썬 테스트
#   make check      테스트 + 빌드 + 린트
#   make preview    Vercel 프리뷰 배포
#   make deploy     Vercel 프로덕션 배포 (check 후)
#   make env-push   .env.local 의 환경변수를 Vercel(prod/preview/dev)에 등록
#   make env-pull   Vercel 환경변수를 .env.local 로 내려받기

SHELL       := /bin/bash
NPM         ?= npm
VERCEL      ?= vercel
PY          ?= .venv/bin/python
PIP         ?= .venv/bin/pip
ENV_FILE    ?= .env.local
ENV_SCOPES  ?= production preview development

.DEFAULT_GOAL := help
.PHONY: help setup install venv dev seed test build lint check clean \
        link preview deploy env-push env-pull

help:
	@grep -E '^#   make' $(MAKEFILE_LIST) | sed 's/^#   /  /'

## --- 설치 -------------------------------------------------------------
setup: install venv

install:
	$(NPM) install

venv:
	python3 -m venv .venv
	$(PIP) install --quiet --upgrade pip openpyxl

## --- 개발 -------------------------------------------------------------
dev:
	$(NPM) run dev

seed:
	@test -x $(PY) || { echo "먼저 'make venv' 를 실행하세요"; exit 1; }
	$(PY) scripts/parse_xlsx.py

test:
	$(NPM) run test
	@test -x $(PY) && $(PY) scripts/test_parse_xlsx.py || \
		echo "(파서 테스트 건너뜀 — 'make venv' 필요)"

build:
	$(NPM) run build

lint:
	npx eslint src/

check: test build lint

clean:
	rm -rf .next out

## --- 배포 (Vercel) --------------------------------------------------
link:
	$(VERCEL) link

preview:
	$(VERCEL)

deploy: check
	$(VERCEL) --prod

# .env.local 의 KEY=VALUE 를 Vercel 세 환경 모두에 등록 (기존 값은 덮어씀)
# 인라인 주석( value  # ... )과 감싼 따옴표는 dotenv 규칙대로 제거한다.
env-push:
	@test -f $(ENV_FILE) || { echo "$(ENV_FILE) 없음"; exit 1; }
	@grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=' $(ENV_FILE) | while IFS= read -r line; do \
	  k=$${line%%=*}; k=$$(printf '%s' "$$k" | tr -d '[:space:]'); \
	  v=$${line#*=}; \
	  v=$$(printf '%s' "$$v" | tr -d '\r' | sed -E 's/[[:space:]]+#.*$$//; s/^[[:space:]]+//; s/[[:space:]]+$$//; s/^"(.*)"$$/\1/; s/^'"'"'(.*)'"'"'$$/\1/'); \
	  [ -z "$$k" ] && continue; \
	  for s in $(ENV_SCOPES); do \
	    $(VERCEL) env rm "$$k" "$$s" -y >/dev/null 2>&1 || true; \
	    printf '%s' "$$v" | $(VERCEL) env add "$$k" "$$s" >/dev/null 2>&1 \
	      && echo "  ✓ $$k ($$s)" || echo "  ✗ $$k ($$s)"; \
	  done; \
	done
	@echo "완료 — 반영하려면 'make deploy'"

env-pull:
	$(VERCEL) env pull $(ENV_FILE)
