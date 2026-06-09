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

export async function POST(req: NextRequest) {
  try {
    const { postId, title, html, accessToken } = await req.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'Google accessToken이 없습니다.' }, { status: 401 })
    }

    if (!process.env.BLOGGER_BLOG_ID) {
      return NextResponse.json({ error: 'BLOGGER_BLOG_ID가 없습니다.' }, { status: 500 })
    }

    if (!postId || !title || !html) {
      return NextResponse.json({ error: 'postId, title, html이 필요합니다.' }, { status: 400 })
    }

    const res = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${process.env.BLOGGER_BLOG_ID}/posts/${postId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content: cleanHtmlForBlogger(html),
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Blogger 업데이트 실패', detail: data },
        { status: res.status }
      )
    }

    return NextResponse.json({ id: data.id, url: data.url, title: data.title })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Blogger 업데이트 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
