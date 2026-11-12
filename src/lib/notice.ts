/** 공지 모달을 숨길지 — 순수 함수(저장소·경로 읽기는 NoticeDialog가).
 *  - 닫기: 지금 보고 있는 쪽에서만 숨김. 다른 쪽(경로)으로 옮기거나 새로 열면 다시 뜬다.
 *    같은 쪽에서 쿼리만 바뀌는 것(월 넘기기 ?y=&m=)은 같은 쪽으로 본다.
 *  - 오늘 하루 보지 않기: 누른 날(한국 날짜)이 오늘과 같으면 그 브라우저에서 숨김, 다음 날 다시 뜬다. */
export function noticeHidden(opts: {
  closedOnPath: string | null;
  path: string;
  hiddenOn: string | null;
  today: string;
}): boolean {
  return opts.closedOnPath === opts.path || opts.hiddenOn === opts.today;
}
