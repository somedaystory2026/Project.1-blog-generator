import { NextRequest, NextResponse } from 'next/server'

function cleanHtmlForBlogger(html: string) {
  return String(html || '')
    .replace(/<!DOCTYPE html>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .trim()
}

function normalizeLabels(labels: unknown[]) {
  return [
    ...new Set(
      labels
        .filter((label): label is string => typeof label === 'string')
        .map(label => label.replace(/^#/, '').replace(/[^\p{L}\p{N}_-]/gu, '').trim())
        .filter(Boolean)
        .slice(0, 5)
    ),
  ]
}

function guessLabels(title: string) {
  const labels: string[] = []

  if (/코스피|코스닥|주식|증시|ETF|배당|매수|매도|종목/.test(title)) {
    labels.push('주식경제')
  }

  if (/부동산|아파트|분양|전세|월세|청약/.test(title)) {
    labels.push('부동산')
  }

  if (/지원금|복지|장려금|수당|급여/.test(title)) {
    labels.push('지원금')
  }

  if (/청년|대학생|취업|일자리/.test(title)) {
    labels.push('청년정책')
  }

  if (/정부|정책|행정|국토부|기재부|복지부/.test(title)) {
    labels.push('정부정책')
  }

  if (/세계|미국|중국|일본|전쟁|외교|국제/.test(title)) {
    labels.push('세상뉴스')
  }

  if (labels.length === 0) {
    labels.push('일반')
  }

  return normalizeLabels(labels)
}

export async function POST(req: NextRequest) {
  try {
    const { title, html, accessToken, labels = [] } = await req.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'Google accessToken이 없습니다.' }, { status: 401 })
    }

    if (!process.env.BLOGGER_BLOG_ID) {
      return NextResponse.json({ error: 'BLOGGER_BLOG_ID가 없습니다.' }, { status: 500 })
    }

    if (!title || !html) {
      return NextResponse.json({ error: 'title 또는 html이 없습니다.' }, { status: 400 })
    }

    const postLabels = normalizeLabels(labels).length > 0 ? normalizeLabels(labels) : guessLabels(title)

    const res = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${process.env.BLOGGER_BLOG_ID}/posts/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'blogger#post',
          title,
          content: cleanHtmlForBlogger(html),
          labels: postLabels,
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Blogger 발행 실패', detail: data },
        { status: res.status }
      )
    }

    return NextResponse.json({
      id: data.id,
      url: data.url,
      title: data.title,
      labels: data.labels || postLabels,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Blogger 발행 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
