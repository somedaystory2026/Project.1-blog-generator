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

function stripCodeBlock(text: string) {
  return text
    .replace(/^```json\s*/i, '')
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
    if (!match) throw new Error('기획 JSON 파싱 실패')
    return JSON.parse(jsonrepair(match[0]))
  }
}

function normalizePlan(plan: any, index: number) {
  const order = Number(plan?.order || index + 1)
  const type = order === 5 ? 'main' : 'sub'

  return {
    type,
    order,
    title: String(plan?.title || '').trim(),
    focus: String(plan?.focus || '').trim(),
    searchIntent: String(plan?.searchIntent || '').trim(),
    buttonLabel: String(plan?.buttonLabel || '').trim(),
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 없습니다. .env.local 파일을 확인하세요.' },
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
        (a: Article, i: number) => `[기사 ${i + 1}]
제목: ${a.title}
요약: ${a.summary || '요약 없음'}
출처명: ${a.source || '정책자료'}
원문URL: ${a.link || '없음'}
발행일: ${a.pubDate || '없음'}`
      )
      .join('\n\n')

    const mainKeyword = articles[0]?.title || '정부 정책'

    const prompt = `
너는 대한민국 정부 정책 블로그 SEO 기획자다.
아래 기사들을 바탕으로 5개 글 패키지의 제목과 역할만 기획한다.

[메인 키워드]
${mainKeyword}

===== 참고 기사 =====
${articlesText}
=====================

반드시 JSON만 출력한다.
마크다운 코드블록 금지.
설명 금지.

출력 형식:
{
  "plans": [
    {
      "type": "sub",
      "order": 1,
      "title": "서브글 1 제목",
      "focus": "신청 방법",
      "searchIntent": "사용자가 신청 절차를 알고 싶어 검색하는 의도",
      "buttonLabel": "신청 방법 바로가기"
    },
    {
      "type": "sub",
      "order": 2,
      "title": "서브글 2 제목",
      "focus": "지급 금액과 지급일",
      "searchIntent": "지원 금액, 지급 시기, 지급 기준을 알고 싶어 검색하는 의도",
      "buttonLabel": "지급일·금액 바로가기"
    },
    {
      "type": "sub",
      "order": 3,
      "title": "서브글 3 제목",
      "focus": "자격조건과 대상자",
      "searchIntent": "내가 대상자인지 확인하려는 의도",
      "buttonLabel": "자격조건 바로가기"
    },
    {
      "type": "sub",
      "order": 4,
      "title": "서브글 4 제목",
      "focus": "제출서류와 주의사항",
      "searchIntent": "서류, 제한사항, 실수 방지를 확인하려는 의도",
      "buttonLabel": "필요서류 바로가기"
    },
    {
      "type": "main",
      "order": 5,
      "title": "메인글 제목",
      "focus": "전체 요약과 로드맵",
      "searchIntent": "정책 전체를 한 번에 이해하고 세부글로 이동하려는 의도",
      "buttonLabel": "전체 가이드 보기"
    }
  ]
}

기획 규칙:
1. 반드시 총 5개다.
2. 1~4번은 type이 sub, 5번은 type이 main이다.
3. 5개 제목은 서로 검색 의도가 달라야 한다.
4. 서브글 4개는 각각 독립적으로 검색 유입이 가능해야 한다.
5. 메인글은 전체 로드맵/허브 글 역할을 해야 한다.
6. 제목에 허위 정보, 확정되지 않은 금액, 확정되지 않은 날짜를 단정하지 않는다.
7. 확인되지 않은 내용은 제목에 넣지 않는다.
8. 정부 정책 블로그답게 자연스럽고 검색 친화적인 제목으로 작성한다.
9. 기사 원문과 무관한 제도명, 지역명, 금액을 만들지 않는다.
10. buttonLabel은 짧고 명확한 버튼 문구로 작성한다.
`

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = safeParseJson(raw)

    if (!Array.isArray(parsed.plans) || parsed.plans.length !== 5) {
      return NextResponse.json(
        { error: '5개 글 기획 형식이 아닙니다.' },
        { status: 500 }
      )
    }

    const plans = parsed.plans
      .map((plan: any, index: number) => normalizePlan(plan, index))
      .sort((a: any, b: any) => a.order - b.order)

    const valid =
      plans.length === 5 &&
      plans.slice(0, 4).every((p: any) => p.type === 'sub' && p.title && p.focus) &&
      plans[4]?.type === 'main' &&
      plans[4]?.title &&
      plans[4]?.focus

    if (!valid) {
      return NextResponse.json(
        { error: '기획 결과에 누락된 제목 또는 유형이 있습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ plans })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '기획 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
