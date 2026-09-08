export function ConfigNotice() {
  return (
    <div className="rounded-lg border border-clay-soft bg-clay-wash px-4 py-3 text-[13px] text-ink-2">
      <strong className="font-semibold text-ink">데모 모드</strong> — Supabase 미설정
      상태로, 2026년 1~9월 데이터를 <em>읽기 전용</em>으로 보여줍니다. 편집·저장하려면{" "}
      <code className="rounded bg-paper px-1 py-0.5 text-[12px]">.env.local</code>에
      Supabase 키와 <code className="rounded bg-paper px-1 py-0.5 text-[12px]">ADMIN_PASSWORD</code>를
      넣고 <code className="rounded bg-paper px-1 py-0.5 text-[12px]">supabase/schema.sql</code>을
      실행한 뒤 관리자에서 데이터를 가져오세요. 자세한 절차는 README 참고.
    </div>
  );
}
