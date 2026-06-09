import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Article {
  title: string
  summary: string
  link: string
}

interface GeneratedPost {
  type: 'main' | 'sub'
  order: number
  title: string
  focus: string
  html: string
}

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
    const match = cleaned.match(/\{[\s\S]*\}/)

    if (!match) {
      throw new Error('OpenAI 응답을 JSON으로 파싱할 수 없습니다.')
    }

    return JSON.parse(match[0])
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'OpenAI API 키가 없습니다. .env.local 파일에 OPENAI_API_KEY를 입력했는지 확인하세요.',
        },
        { status: 500 }
      )
    }

    const { articles } = await req.json()

    if (!Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: '기사를 1개 이상 선택해주세요.' },
        { status: 400 }
      )
    }

    const articlesText = articles
      .map(
        (a: Article, i: number) =>
          `[기사 ${i + 1}]
제목: ${a.title}
요약: ${a.summary}
출처: ${a.link}`
      )
      .join('\n\n')

    const mainKeyword = articles[0]?.title || '정부 지원 정책'

    const prompt = `
너는 대한민국 애드센스 승인 및 수익화에 최적화된 SEO 전문 정책 블로그 작가다.

아래 참고 기사와 메인 키워드를 기반으로 총 5개의 블로그 글을 생성한다.

[메인 키워드]
${mainKeyword}

===== 참고 기사 =====
${articlesText}
=====================

반드시 JSON만 출력한다.
마크다운 코드블록 금지.
설명 문장 금지.

출력 JSON 형식:
{
  "posts": [
    {
      "type": "sub",
      "order": 1,
      "title": "서브글 제목",
      "focus": "신청 방법",
      "html": "Blogger 발행용 HTML"
    },
    {
      "type": "sub",
      "order": 2,
      "title": "서브글 제목",
      "focus": "지급 금액과 지급일",
      "html": "Blogger 발행용 HTML"
    },
    {
      "type": "sub",
      "order": 3,
      "title": "서브글 제목",
      "focus": "자격조건과 대상자",
      "html": "Blogger 발행용 HTML"
    },
    {
      "type": "sub",
      "order": 4,
      "title": "서브글 제목",
      "focus": "제출서류와 주의사항",
      "html": "Blogger 발행용 HTML"
    },
    {
      "type": "main",
      "order": 5,
      "title": "메인글 제목",
      "focus": "전체 요약과 로드맵",
      "html": "Blogger 발행용 HTML"
    }
  ]
}

5개 글 구성:
1. 서브글 1: 신청 방법 중심
2. 서브글 2: 지급 금액, 지원 내용, 지급일 중심
3. 서브글 3: 자격조건, 지원 대상 중심
4. 서브글 4: 제출서류, 주의사항 중심
5. 메인글: 전체 요약, 로드맵, 각 서브글로 이동하는 안내 중심

중복 방지 규칙:
1. 5개 글은 서로 다른 검색 의도를 가져야 한다.
2. 동일한 서론, 동일한 결론, 동일한 FAQ 질문을 반복하지 않는다.
3. 같은 표, 같은 사례, 같은 문단을 반복하지 않는다.
4. 메인글은 서브글 내용을 길게 복붙하지 않고 요약만 작성한다.
5. 서브글은 각자의 주제에 집중한다.
6. 확인되지 않은 내용은 추측하지 말고 "공식 발표 확인 필요"라고 작성한다.

HTML 공통 규칙:
1. 각 html은 Blogger 자동 발행용 HTML만 작성한다.
2. 절대 <!DOCTYPE html>, <html>, <head>, <body> 태그를 쓰지 않는다.
3. 절대 meta 태그, canonical 태그, og 태그, JSON-LD script 태그를 쓰지 않는다.
4. 각 html 첫 줄은 반드시 <style> 로 시작한다.
5. <style> 다음에는 반드시 <div class="wp-modern-post"> 로 본문을 시작한다.
6. 마지막 해시태그 영역은 반드시 <div class="hashtags"> 로 작성한다.
7. 해시태그는 반드시 #태그 형식으로 5개만 작성한다.
8. 공식 홈페이지 버튼은 반드시 <a class="cta-btn"> 형태로 작성한다.
9. 면책문구는 모든 글 하단에 반드시 포함한다.

각 글 작성 규칙:
1. 각 글 본문은 최소 2,500자 이상 작성한다.
2. H1 제목은 1개만 사용한다.
3. H2는 4개 이상 사용한다.
4. 핵심요약 박스를 만든다.
5. 목차를 만든다.
6. 표를 최소 1개 이상 삽입한다.
7. FAQ를 최소 5개 작성한다.
8. 공식 홈페이지 확인 버튼을 본문 중간과 마지막에 각각 1개씩 넣는다.
9. 과장된 표현, 허위 정보, 확정되지 않은 지급 조건은 쓰지 않는다.
10. 최신 기준은 공식 홈페이지에서 확인해야 한다는 문구를 포함한다.

메인글 전용 규칙:
1. 메인글은 전체 로드맵과 요약 중심으로 작성한다.
2. 메인글에는 아래 HTML 블록을 반드시 포함한다.
3. href 값은 일단 SUB_POST_1_URL, SUB_POST_2_URL, SUB_POST_3_URL, SUB_POST_4_URL 로 작성한다.
4. 실제 발행 후 page.tsx에서 URL을 치환한다.

메인글 바로가기 버튼 HTML:
<h2 class="wp-h2" id="quick-links">관련 글 빠르게 보기</h2>
<div class="related-button-box">
  <a class="related-btn" href="SUB_POST_1_URL">신청 방법 바로가기</a>
  <a class="related-btn" href="SUB_POST_2_URL">지급일·금액 바로가기</a>
  <a class="related-btn" href="SUB_POST_3_URL">자격조건 바로가기</a>
  <a class="related-btn" href="SUB_POST_4_URL">필요서류 바로가기</a>
</div>

면책문구 HTML:
<div class="disclaimer-box">
  <p>
    <strong>면책문구</strong><br>
    본 글은 공개된 정부 정책 자료와 공식 발표 내용을 바탕으로 작성된 정보 제공용 글입니다.
    정책의 신청 기간, 지원 대상, 지급 금액, 제출 서류 등은 기관 사정에 따라 변경될 수 있습니다.
    최종 신청 전 반드시 정부24, 지자체 또는 해당 기관 공식 홈페이지에서 최신 내용을 확인하시기 바랍니다.
  </p>
</div>

반드시 아래 CSS를 각 html의 <style> 안에 포함한다.

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

공식 홈페이지 URL은 기사 출처 또는 관련 정부기관 사이트를 사용한다.
알 수 없으면 https://www.gov.kr 사용.
`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = safeParseJson(raw)

    if (!Array.isArray(parsed.posts) || parsed.posts.length !== 5) {
      return NextResponse.json(
        { error: 'OpenAI가 5개 글 형식으로 응답하지 않았습니다.' },
        { status: 500 }
      )
    }

    const posts: GeneratedPost[] = parsed.posts.map((post: GeneratedPost) => ({
      type: post.type,
      order: post.order,
      title: post.title,
      focus: post.focus,
      html: stripCodeBlock(post.html || ''),
    }))

    return NextResponse.json({
      mode: 'package',
      posts,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}