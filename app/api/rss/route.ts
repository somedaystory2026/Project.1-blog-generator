import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; GovBlogHelper/1.0)',
  },
})

export async function POST(req: NextRequest) {
  try {
    const { urls, keyword } = await req.json()

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'RSS URL을 한 줄 이상 입력해주세요.' },
        { status: 400 }
      )
    }

    const allItems: {
      title: string
      link: string
      summary: string
      pubDate: string
      source: string
    }[] = []

    const results = await Promise.allSettled(
      urls.map((url: string) => parser.parseURL(url))
    )

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const feed = result.value

        for (const item of feed.items) {
          allItems.push({
            title: item.title?.trim() || '(제목 없음)',
            link: item.link || '',
            summary: (
              item.contentSnippet ||
              item.content ||
              item.summary ||
              ''
            )
              .replace(/<[^>]*>/g, '')
              .slice(0, 300)
              .trim(),
            pubDate: item.pubDate || item.isoDate || '',
            source: feed.title || urls[idx],
          })
        }
      }
    })

    allItems.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0
      return tb - ta
    })

    const kw = (keyword || '').trim().toLowerCase()
    let filtered = allItems

    if (kw) {
      filtered = allItems.filter((item) => {
        const title = item.title.toLowerCase()
        const summary = item.summary.toLowerCase()
        return title.includes(kw) || summary.includes(kw)
      })
    }

    return NextResponse.json({ items: filtered.slice(0, 20) })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}