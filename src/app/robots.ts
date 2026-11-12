import type { MetadataRoute } from "next";

/** 로그인 뒤에만 보이는 학교 내부 도구 — 검색엔진이 어떤 쪽도 담지 않게(servicekit seo "비공개 도구").
 *  사이트맵·IndexNow는 두지 않는다. 각 페이지 <meta name="robots" content="noindex">는 layout metadata. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
