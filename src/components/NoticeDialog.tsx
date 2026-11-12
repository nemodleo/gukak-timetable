"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CONTACT_EMAIL } from "@/lib/contact";

const KEY = "gkt_notice_closed";

/* 닫힘 여부는 sessionStorage가 원본 — useSyncExternalStore로 읽어 서버 렌더(닫힘)와
 * 클라이언트(저장소 값)가 어긋나도 하이드레이션 오류 없이 넘어간다. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function readClosed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false; // 저장소를 못 쓰면 매번 띄운다
  }
}
function markClosed() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** 비로그인 첫 진입 때 로그인 카드 위에 먼저 뜨는 공지 모달. 처음 오는
 *  국악고 선생님이 비밀번호·수정·운영 문의를 어디로 보낼지 바로 알 수 있게.
 *  닫으면 그 탭(sessionStorage)에서는 다시 안 뜨고, 새로 들어오면 다시 뜬다. */
export function NoticeDialog() {
  const storedClosed = useSyncExternalStore(subscribe, readClosed, () => true);
  const [closedHere, setClosedHere] = useState(false); // 저장소가 막혀도 닫히게
  const open = !storedClosed && !closedHere;
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    markClosed();
    setClosedHere(true);
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/45" onClick={close} role="presentation" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gkt-notice-title"
        className="fixed left-4 right-4 top-[14vh] z-50 mx-auto max-w-sm break-keep rounded-xl border border-line bg-paper px-5 py-6 shadow-2xl [overflow-wrap:anywhere]"
      >
        <p className="text-[12px] font-semibold tracking-wide text-ink-2">안내</p>
        <h2 id="gkt-notice-title" className="mt-1.5 font-serif text-[20px] font-medium leading-snug">
          국악고 선생님께
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">
          이 사이트는 국립국악고등학교 강사·강의실 시간표를 보고 짜는 곳입니다. 학생 이름이
          있어 비밀번호가 있어야 열립니다.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          서비스는 언제나 열려 있습니다. 비밀번호를 받으시려면, 기능을 고치거나 더하고
          싶으시면, 운영에 관해 물어볼 것이 있으면 아래 주소로 메일을 주세요.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-3 block rounded-lg border border-line-strong bg-paper-2 px-3 py-2.5 text-center text-[15px] text-ink"
        >
          {CONTACT_EMAIL}
        </a>
        <div className="mt-4 flex gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="h-10 flex-1 rounded-md border border-line-strong text-[14px] text-ink-2"
          >
            닫기
          </button>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[국악고 시간표] 문의")}`}
            className="flex h-10 flex-1 items-center justify-center rounded-md bg-ink text-[14px] text-paper"
          >
            메일 보내기
          </a>
        </div>
      </div>
    </>
  );
}
