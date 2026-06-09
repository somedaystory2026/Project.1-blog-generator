import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { jsonrepair } from 'jsonrepair'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Article {
  title: string
  summary: string
  link: string
  source?: string
  pubDate?: string
}

interface Plan {
  type: 'main' | 'sub'
  order: number
  title: string
  focus: string
  searchIntent?: string
  buttonLabel?: string
}

const BASE_CSS = `
.wp-modern-post {
  font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", Arial, sans-serif;
  line-height: 1.85;
  color: #333333;
  max-width: 820px;
  margin: 0 auto;
  padding: 20px;
  word-break: keep-all;
  background: #ffffff;
}
.wp-modern-post h1 {
  font-size: 2rem;
  line-height: 1.35;
  color: #1f2937;
  margin: 10px 0 28px;
  font-weight: 800;
}
.wp-h2 {
  font-size: 1.55rem;
  color: #1f2937;
  margin: 52px 0 22px;
  padding: 16px 18px;
  border-left: 7px solid #2563eb;
  background: #eff6ff;
  border-radius: 0 12px 12px 0;
  font-weight: 800;
}
.wp-h3 {
  font-size: 1.22rem;
  color: #2563eb;
  margin: 28px 0 12px;
  font-weight: 800;
}
.wp-text {
  font-size: 1.05rem;
  margin: 0 0 22px;
  color: #374151;
}
.summary-box {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-left: 7px solid #2563eb;
  border-radius: 16px;
  padding: 24px;
  margin: 30px 0;
}
.toc {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  margin: 34px 0;
}
.toc-title {
  font-size: 1.2rem;
  font-weight: 800;
  margin-bottom: 12px;
  color: #1f2937;
}
.card-box {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
  margin: 28px 0;
  box-shadow: 0 8px 22px rgba(0,0,0,0.05);
}
.warning-box {
  background: #fff7ed;
  border-left: 7px solid #f97316;
  border-radius: 14px;
  padding: 22px;
  margin: 30px 0;
  color: #7c2d12;
}
.table-wrap {
  overflow-x: auto;
  margin: 30px 0;
}
.wp-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
}
.wp-table th {
  background: #2563eb;
  color: #ffffff;
  padding: 14px;
  text-align: left;
}
.wp-table td {
  border-bottom: 1px solid #e5e7eb;
  padding: 14px;
  color: #374151;
  vertical-align: top;
}
.cta-container {
  text-align: center;
  margin: 42px 0;
}
.cta-btn {
  display: inline-block;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff !important;
  text-decoration: none !important;
  padding: 15px 30px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.05rem;
}
.related-button-box {
  display: grid;
  gap: 14px;
  margin: 28px 0;
}
.related-btn {
  display: block;
  background: #ef4444;
  color: #ffffff !important;
  text-decoration: none !important;
  padding: 14px 18px;
  border-radius: 10px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(239,68,68,0.22);
}
.disclaimer-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-left: 6px solid #9ca3af;
  border-radius: 14px;
  padding: 20px;
  margin: 36px 0;
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.8;
}
.faq-section {
  margin: 40px 0;
}
.faq-item {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 22px;
  margin-bottom: 16px;
}
.faq-question {
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 10px;
  font-size: 1.08rem;
}
.faq-answer {
  color: #4b5563;
  font-size: 1rem;
}
.hashtags {
  margin-top: 44px;
  padding: 22px;
  border-radius: 14px;
  background: #f8fafc;
  color: #2563eb;
  font-weight: 700;
  line-height: 1.9;
  word-break: keep-all;
}
`

function stripCodeBlock(text: string) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

function safeParseJson(text: string) {
  const cleaned = stripCodeBlock(text)

  try {
    return JSON.parse(cleaned)
  } catch {
    try {
      return JSON.parse(jsonrepair(cleaned))
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('글 JSON 파싱 실패')
      return JSON.parse(jsonrepair(match[0]))
    }
  }
}

function cleanGeneratedHtml(html: string) {
  let cleaned = stripCodeBlock(html || '')

  cleaned = cleaned
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<html[\s\S]*?>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[\s\S]*?>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/<a\s+name="[^"]*"><\/a>/gi, '')
    .replace(/<div class="post-share-buttons[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="post-header[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="post-footer[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .trim()

  const styleIndex = cleaned.search(/<style[\s\S]*?>/i)
  if (styleIndex > 0) cleaned = cleaned.slice(styleIndex).trim()

  const wpIndex = cleaned.search(/<div class="wp-modern-post">/i)
  if (wpIndex > 0 && !cleaned.slice(0, wpIndex).includes('<style')) {
    cleaned = `<style>\n${BASE_CSS}\n</style>\n${cleaned.slice(wpIndex).trim()}`
  }

  if (!cleaned.startsWith('<style')) {
    cleaned = `<style>\n${BASE_CSS}\n</style>\n${cleaned}`
  }

  if (!cleaned.includes('<div class="wp-modern-post">')) {
    cleaned = `${cleaned}\n<div class="wp-modern-post">\n</div>`
  }

  cleaned = addBlankTargetToLinks(cleaned)

  return cleaned
}

function getOfficialUrl(articles: Article[]) {
  const firstLink = articles.find(a => a.link)?.link
  return firstLink || 'https://www.gov.kr'
}

function detectTopicType(title: string, articles: Article[]) {
  const text = `${title} ${articles.map(a => `${a.title} ${a.summary}`).join(' ')}`

  if (/코스피|코스닥|주식|증시|ETF|배당|매수|매도|환율|금리|경제|시장|투자|사이드카|서킷브레이커/i.test(text)) {
    return 'stock'
  }

  if (/부동산|아파트|분양|전세|월세|청약|주택|재건축|재개발|대출/i.test(text)) {
    return 'realestate'
  }

  if (/지원금|복지|장려금|수당|급여|신청|대상|서류|정부|정책|지자체|고용|육아|출산/i.test(text)) {
    return 'policy'
  }

  return 'news'
}

function addBlankTargetToLinks(html: string) {
  return html.replace(/<a\b([^>]*?)>/gi, (match, attrs) => {
    let nextAttrs = attrs

    if (/\starget=/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\starget=("[^"]*"|'[^']*'|[^\s>]*)/i, ' target="_blank"')
    } else {
      nextAttrs += ' target="_blank"'
    }

    if (/\srel=/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\srel=("[^"]*"|'[^']*'|[^\s>]*)/i, ' rel="noopener noreferrer"')
    } else {
      nextAttrs += ' rel="noopener noreferrer"'
    }

    return `<a${nextAttrs}>`
  })
}

function buildRelatedLinksHtml(subLinks: any[], topicType = 'policy') {
  const defaultLabels = topicType === 'stock'
    ? ['시장 상황 바로가기', '투자 전략 바로가기', '위험 관리 바로가기', '전망 분석 바로가기']
    : topicType === 'realestate'
      ? ['청약 방법 바로가기', '금액·대출 바로가기', '자격조건 바로가기', '서류·주의사항 바로가기']
      : ['신청 방법 바로가기', '지급일·금액 바로가기', '자격조건 바로가기', '필요서류 바로가기']

  if (!Array.isArray(subLinks) || subLinks.length === 0) {
    return `
<h2 class="wp-h2" id="quick-links">관련 글 빠르게 보기</h2>
<div class="related-button-box">
  <a class="related-btn" href="SUB_POST_1_URL" target="_blank" rel="noopener noreferrer">${defaultLabels[0]}</a>
  <a class="related-btn" href="SUB_POST_2_URL" target="_blank" rel="noopener noreferrer">${defaultLabels[1]}</a>
  <a class="related-btn" href="SUB_POST_3_URL" target="_blank" rel="noopener noreferrer">${defaultLabels[2]}</a>
  <a class="related-btn" href="SUB_POST_4_URL" target="_blank" rel="noopener noreferrer">${defaultLabels[3]}</a>
</div>`
  }

  const buttons = subLinks
    .slice(0, 4)
    .map((item: any, index: number) => {
      const url = String(item?.url || `SUB_POST_${index + 1}_URL`)
      const label = String(item?.buttonLabel || defaultLabels[index] || item?.title || `관련 글 ${index + 1}`)
      return `  <a class="related-btn" href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })
    .join('\n')

  return `
<h2 class="wp-h2" id="quick-links">관련 글 빠르게 보기</h2>
<div class="related-button-box">
${buttons}
</div>`
}
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 없습니다. .env.local 파일을 확인하세요.' },
        { status: 500 }
      )
    }

    const {
      articles,
      plan,
      subLinks = [],
      previousUrl = '',
      nextUrl = '',
      mainUrl = '',
    } = await req.json()

    if (!Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: '기사를 1개 이상 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!plan?.title || !plan?.type) {
      return NextResponse.json(
        { error: '글 기획 정보가 없습니다.' },
        { status: 400 }
      )
    }

    const p = plan as Plan
    const officialUrl = getOfficialUrl(articles)
    const topicType = detectTopicType(p.title, articles)

    const articlesText = articles
      .map(
        (a: Article, i: number) => `[기사 ${i + 1}]
제목: ${a.title}
요약: ${a.summary || '요약 없음'}
출처명: ${a.source || '정책자료'}
원문URL: ${a.link || '없음'}
발행일: ${a.pubDate || '없음'}`
      )
      .join('\n\n')

    const relatedLinksHtml = buildRelatedLinksHtml(subLinks, topicType)
    
    const topicGuide = topicType === 'stock'
      ? `
[주제 유형: 주식·경제 분석형]
- 절대 정부 지원금 글처럼 쓰지 않는다.
- "지원 대상", "신청 방법", "필요서류", "지급일" 표현을 쓰지 않는다.
- 썸네일이나 본문 문구에도 "정부 정책 안내" 느낌을 만들지 않는다.
- 시장 배경, 지수 흐름, 수급, 환율, 금리, 투자심리, 리스크 관리, 투자 전략, 향후 시나리오 중심으로 작성한다.
- 투자 조언은 단정하지 말고 정보 제공 관점으로 쓴다.
- 면책문구는 투자 위험 고지형으로 자연스럽게 작성한다.
`
      : topicType === 'realestate'
        ? `
[주제 유형: 부동산 분석형]
- 청약, 주택공급, 대출, 전세·월세, 세금, 실수요자 관점으로 작성한다.
- 단순 정책 요약이 아니라 실제 수요자가 어떻게 준비해야 하는지 설명한다.
`
        : topicType === 'policy'
          ? `
[주제 유형: 정부 정책·지원금 가이드형]
- 신청 대상, 신청 방법, 금액, 기간, 제출서류, 주의사항 중심으로 작성한다.
- 확인되지 않은 내용은 공식 발표 확인 필요라고 쓴다.
`
          : `
[주제 유형: 세상뉴스 분석형]
- 사건 요약이 아니라 배경, 쟁점, 영향, 앞으로 볼 포인트를 중심으로 작성한다.
`

    const navRule = p.type === 'sub'
      ? `
서브글 내부링크 규칙:
1. 본문 후반부, FAQ 바로 위에 아래 이전글/다음글/메인글 버튼 HTML을 반드시 딱 1회만 포함한다.
2. 동일한 버튼을 추가 생성하지 않는다.
3. href 값은 실제 URL이 있으면 실제 URL을 사용하고, 아직 없으면 placeholder를 유지한다.
4. 모든 버튼 링크는 새창으로 열리도록 target="_blank" rel="noopener noreferrer" 속성을 반드시 포함한다.

[반드시 포함할 이전글/다음글/메인글 버튼 HTML]
`
      : `
메인글 내부링크 규칙:
1. 본문 중간 또는 후반에 아래 관련글 버튼 HTML을 반드시 그대로 포함한다.
2. href 값은 실제 발행된 서브글 URL이다. 임의로 바꾸지 않는다.
3. 버튼 문구는 글 주제에 맞게 명확하게 유지한다.
4. 모든 버튼 링크는 새창으로 열리도록 target="_blank" rel="noopener noreferrer" 속성을 반드시 포함한다.

[반드시 포함할 관련글 버튼 HTML]
${relatedLinksHtml}
`

    const prompt = `
너는 대한민국 애드센스 승인 및 수익화에 최적화된 SEO 전문 블로그 작가다.
아래 기사와 글 기획을 바탕으로 블로그 글 1개만 생성한다.

주제에 따라 글 스타일을 자동 변경한다.
정부 정책 → 정책 분석형
지원금 → 신청 가이드형
부동산 → 부동산 분석형
주식·경제 → 투자 분석형
세상뉴스 → 뉴스 분석형

절대 모든 글을 정부 정책 글처럼 작성하지 않는다.

${topicGuide}

[글 유형]
${p.type}

[글 순서]
${p.order}

[제목]
${p.title}

[집중 주제]
${p.focus}

[검색 의도]
${p.searchIntent || '정보를 쉽게 이해하려는 검색 의도'}

[공식 확인 URL 우선 사용]
${officialUrl}

===== 참고 기사 =====
${articlesText}
=====================

${navRule}

반드시 JSON만 출력한다.
마크다운 코드블록 금지.
설명 문장 금지.

출력 JSON 형식:
{
  "title": "최종 제목",
  "html": "Blogger 발행용 HTML"
}

HTML 출력 형태는 반드시 아래 순서를 따른다.
1. <style>
2. 아래 CSS 전체
3. </style>
4. <div class="wp-modern-post">
5. <h1>제목</h1>
6. <div class="summary-box"><p><strong>핵심요약</strong><br>요약문</p></div>
7. <div class="toc"><p class="toc-title">목차</p><ul><li><a href="#...">1. 섹션 제목</a></li></ul></div>
8. <h2 class="wp-h2" id="...">1. 섹션 제목</h2>
9. 각 문단은 반드시 <p class="wp-text">문단</p> 형태로 작성한다.
10. 본문 H2 섹션은 최소 6개 이상 작성한다.
11. 각 H2 섹션마다 <p class="wp-text"> 문단을 최소 3개 이상 작성한다.
12. 본문 중간에 <div class="table-wrap"><table class="wp-table">표</table></div>를 최소 1개 이상 넣는다.
13. 본문 중간에 <div class="cta-container"><a class="cta-btn" href="공식URL" target="_blank" rel="noopener noreferrer nofollow">공식 홈페이지 확인</a></div>를 1개 넣는다.
14. <div class="faq-section">FAQ 7개 이상</div>
15. 마지막 공식 홈페이지 CTA 버튼
16. ${p.type === 'main'
  ? '관련글 버튼 영역은 반드시 제공된 HTML만 1회 사용'
  : '이전글/다음글/메인글 버튼 영역은 반드시 제공된 HTML만 1회 사용'}
17. 면책문구
18. <div class="hashtags">#태그 5개</div>
19. </div>

중요:
중복 버튼 방지 규칙:
- 관련글 버튼을 새로 생성하지 않는다.
- 이전글/다음글 버튼을 새로 생성하지 않는다.
- 제공된 HTML만 정확히 1회 사용한다.
- 동일한 버튼 영역을 2번 출력하지 않는다.

디자인 강제 규칙:
- 모든 H2는 반드시 <h2 class="wp-h2" id="..."> 형식으로 작성한다.
- 일반 <h2 id="...">는 절대 쓰지 않는다.
- 모든 본문 문단은 반드시 <p class="wp-text"> 형식으로 작성한다.
- 요약박스 제목은 반드시 "핵심요약"으로 작성한다.
- 목차 제목은 반드시 "목차"로 작성한다.
- 목차는 왼쪽 예시처럼 카드 박스 안에 ul/li 구조로 작성한다.
- 섹션 제목에는 반드시 "1. 제목", "2. 제목"처럼 번호를 포함한다.

장문 작성 규칙:
1. 최종 HTML 본문은 최소 5,500자 이상 작성한다.
2. 목표 분량은 6,000~8,000자다.
3. 기사 요약이 아니라 전문 블로그 글처럼 작성한다.
4. H2는 최소 6개 이상 작성한다.
5. 각 H2 섹션은 최소 500자 이상 작성한다.
6. 각 H2마다 3~5개 문단을 작성한다.
7. 단순 요약 금지.
8. 배경 설명을 충분히 추가한다.
9. 이 이슈가 왜 중요한지 설명한다.
10. 실제 독자가 궁금해할 내용과 활용 방법을 추가한다.
11. 주의사항과 리스크를 추가한다.
12. 향후 전망 또는 체크포인트를 추가한다.
13. FAQ는 최소 7개 작성한다.
14. 표는 최소 2개 작성한다.
15. CTA 버튼은 최소 2개 작성한다.
16. 목차는 최소 6개 항목으로 작성한다.
17. SEO 최적화를 위해 핵심 키워드를 자연스럽게 반복한다.
18. 글이 짧으면 스스로 추가 설명을 작성하여 분량을 채운다.
19. 최종 결과는 사람이 직접 작성한 전문 블로그 수준이어야 한다.
20. 기사 원문에 없는 구체 금액, 날짜, 지수, 환율, 수치, 지역, 대상 조건을 새로 만들지 않는다.
21. 확인되지 않은 내용은 "공식 발표 확인 필요"라고 작성한다.
22. 글투는 초보자도 이해하기 쉽게, 그러나 전문 블로그답게 신뢰감 있게 작성한다.

중요:
- 썸네일 이미지는 page.tsx에서 자동 삽입하므로 절대 생성하지 않는다.
- <img> 태그를 생성하지 않는다.
- 모든 <a> 태그는 반드시 target="_blank" rel="noopener noreferrer" 속성을 포함한다.
- 공식 홈페이지 CTA 버튼은 rel="noopener noreferrer nofollow"를 사용한다.
- Blogger 기본 껍데기 HTML을 절대 생성하지 않는다.
- JSON-LD, script, meta, canonical, og 태그를 절대 생성하지 않는다.
- <div class="post">, post-header, post-footer, post-share-buttons를 절대 생성하지 않는다.
- <!DOCTYPE html>, <html>, <head>, <body> 태그를 절대 생성하지 않는다.
- html 첫 글자는 반드시 <style> 이어야 한다.
- <style> 바로 다음에는 반드시 <div class="wp-modern-post"> 로 본문을 시작한다.

면책문구는 글 주제에 맞게 작성한다.
- 주식/경제 글이면 투자 손실 가능성과 투자 판단은 본인 책임이라는 문구를 포함한다.
- 정부정책/지원금 글이면 정책 변경 가능성과 공식 홈페이지 확인 문구를 포함한다.
- 부동산 글이면 정책·금리·시장 상황 변동 가능성을 포함한다.

반드시 아래 CSS를 각 html의 <style> 안에 포함한다.
${BASE_CSS}
`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = safeParseJson(raw)

    const title = String(parsed.title || p.title).trim()
    const html = cleanGeneratedHtml(String(parsed.html || ''))

    if (!html.includes('<style') || !html.includes('<div class="wp-modern-post">')) {
      return NextResponse.json(
        { error: 'HTML 기본 구조가 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      title,
      html,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '글 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
