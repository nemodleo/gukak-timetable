/** 공지 모달을 숨길지 — 순수 함수(저장소 읽기는 NoticeDialog가). 
 *  - 닫기: 그 탭(sessionStorage)에서만 숨김, 새 탭·새 창이면 다시 뜬다.
 *  - 오늘 하루 보지 않기: 누른 날(한국 날짜)이 오늘과 같으면 그 브라우저에서 숨김, 다음 날 다시 뜬다. */
export function noticeHidden(opts: {
  closedThisTab: boolean;
  hiddenOn: string | null;
  today: string;
}): boolean {
  return opts.closedThisTab || opts.hiddenOn === opts.today;
}
