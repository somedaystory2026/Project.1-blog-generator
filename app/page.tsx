'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'

interface Article {
  title: string
  link: string
  summary: string
  pubDate: string
  source: string
}

interface Plan {
  type: 'main' | 'sub'
  order: number
  title: string
  focus: string
}

interface PublishedPost {
  id: string
  type: 'main' | 'sub'
  order: number
  title: string
  html: string
  url: string
}

const DEFAULT_RSS_URLS = [
  'https://www.korea.kr/rss/policy.xml',
  'https://www.korea.kr/rss/reporter.xml',
  'https://www.korea.kr/rss/column.xml',
  'https://www.korea.kr/rss/insight.xml',
  'https://www.korea.kr/rss/media.xml',
  'https://www.korea.kr/rss/shorts.xml',
  'https://www.korea.kr/rss/visual.xml',
  'https://www.korea.kr/rss/photo.xml',
  'https://www.korea.kr/rss/cartoon.xml',
  'https://www.korea.kr/rss/pressrelease.xml',
  'https://www.korea.kr/rss/fact.xml',
  'https://www.korea.kr/rss/ebriefing.xml',
  'https://www.korea.kr/rss/president.xml',
  'https://www.korea.kr/rss/cabinet.xml',
  'https://www.korea.kr/rss/speech.xml',
  'https://www.korea.kr/rss/expdoc.xml',
  'https://www.korea.kr/rss/archive.xml',
].join('\n')
const RSS_PRESETS = {
  policy: [
    'https://www.korea.kr/rss/policy.xml',
    'https://www.korea.kr/rss/reporter.xml',
    'https://www.korea.kr/rss/column.xml',
    'https://www.korea.kr/rss/insight.xml',
  ].join('\n'),

  support: [
    'https://www.korea.kr/rss/policy.xml',
    'https://www.korea.kr/rss/pressrelease.xml',
    'https://www.korea.kr/rss/fact.xml',
  ].join('\n'),

  realestate: [
    'https://www.korea.kr/rss/policy.xml',
    'https://www.korea.kr/rss/pressrelease.xml',
  ].join('\n'),

  news: [
    'https://rss.donga.com/total.xml',
    'https://www.hani.co.kr/rss/',
  ].join('\n'),

  alerts: [
    'https://www.google.com/alerts/feeds/11486085013446246491/12941890516588757768',
    'https://www.google.com/alerts/feeds/11486085013446246491/10576901034398296665',
    'https://www.google.com/alerts/feeds/11486085013446246491/3803700139179451872',
    'https://www.google.com/alerts/feeds/11486085013446246491/12941890516588759746',
    'https://www.google.com/alerts/feeds/11486085013446246491/14719258356269846044',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko'
  ].join('\n'),
 }
const RESULT_COUNT_OPTIONS = [10, 20, 40]

export default function Home() {
  const [rssUrls, setRssUrls] = useState(DEFAULT_RSS_URLS)
  const [keyword, setKeyword] = useState('')
  const [resultCount, setResultCount] = useState(20)
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest')

  const [articles, setArticles] = useState<Article[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [oneClickPublishing, setOneClickPublishing] = useState(false)
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [progress, setProgress] = useState('')
  const [progressLog, setProgressLog] = useState<string[]>([])
const applyPreset = (key: keyof typeof RSS_PRESETS) => {
  setRssUrls(RSS_PRESETS[key])
}
  const addProgress = (message: string) => {
    setProgress(message)
    setProgressLog(prev => [...prev, message].slice(-12))
  }

  const fetchArticles = async () => {
    setLoading(true)
    setError('')
    setArticles([])
    setSelected(new Set())
    setHtml('')
    setPublishedUrl('')
    setProgress('')
    setProgressLog([])

    const urls = rssUrls.split('\n').map(u => u.trim()).filter(Boolean)

    try {
      const res = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, keyword }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '수집 실패')

      let items: Article[] = data.items || []

      items = Array.from(
        new Map(items.map(item => [item.link || `${item.title}-${item.source}`, item])).values()
      )

      items = [...items].sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0
        return sortOrder === 'latest' ? tb - ta : ta - tb
      })

      items = items.slice(0, resultCount)
      setArticles(items)

      if (items.length === 0) setError('조건에 맞는 기사를 찾지 못했습니다. 키워드를 변경해보세요.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (i: number) => {
    const next = new Set(selected)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === articles.length) setSelected(new Set())
    else setSelected(new Set(articles.map((_, i) => i)))
  }

  const extractTitleFromHtml = (value: string) => {
    const h1Match = value.match(/<h1[^>]*>(.*?)<\/h1>/i)
    if (h1Match?.[1]) return h1Match[1].replace(/<[^>]+>/g, '').trim()
    return '정부 정책 블로그'
  }

  const createThumbnailHtml = (title: string) => {
    const safeTitle = title.replace(/</g, '').replace(/>/g, '').replace(/&/g, 'and')
    const words = safeTitle.split(' ')
    let line1 = ''
    let line2 = ''

    for (const word of words) {
      if ((line1 + ' ' + word).length <= 22) line1 += (line1 ? ' ' : '') + word
      else line2 += (line2 ? ' ' : '') + word
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#2563eb"/><rect x="70" y="70" width="1060" height="490" rx="36" fill="#ffffff"/><text x="100" y="170" font-size="38" font-weight="700" fill="#2563eb">정부 정책 안내</text><text x="100" y="250" font-size="48" font-weight="800" fill="#111827">${line1}</text><text x="100" y="320" font-size="48" font-weight="800" fill="#111827">${line2}</text><text x="100" y="410" font-size="34" fill="#374151">지원 대상 · 신청 방법 · 핵심 요약</text><text x="100" y="500" font-size="30" fill="#6b7280">최신 기준은 공식 홈페이지에서 확인하세요</text></svg>`
    const encoded = encodeURIComponent(svg)
    return `<img src="data:image/svg+xml;charset=UTF-8,${encoded}" alt="${safeTitle}" style="width:100%;max-width:820px;border-radius:18px;margin:0 auto 28px;display:block;" />`
  }

  const insertThumbnail = (postHtml: string, title: string) => {
    const thumbnailHtml = createThumbnailHtml(title)
    if (postHtml.includes('<div class="wp-modern-post">')) {
      return postHtml.replace('<div class="wp-modern-post">', `<div class="wp-modern-post">\n${thumbnailHtml}`)
    }
    return `${thumbnailHtml}\n${postHtml}`
  }

  const removeInternalLinksBox = (postHtml: string) => {
    return postHtml
      .replace(/<!-- INTERNAL_LINKS_START -->[\s\S]*?<!-- INTERNAL_LINKS_END -->/g, '')
      .replace(/<h2 class="wp-h2" id="post-navigation">이전글·다음글 바로가기<\/h2>\s*<div class="related-button-box">[\s\S]*?<\/div>/g, '')
      .replace(/<h2 class="wp-h2" id="internal-links">이전글·다음글 바로가기<\/h2>\s*<div class="related-button-box">[\s\S]*?<\/div>/g, '')
      .trim()
  }

  const buildInternalLinksBox = ({
    prev,
    next,
    main,
  }: {
    prev?: PublishedPost
    next?: PublishedPost
    main?: PublishedPost
  }) => {
    const buttons = [
      prev
        ? `<a class="related-btn" href="${prev.url}" target="_blank" rel="noopener noreferrer">← 이전글: ${prev.title}</a>`
        : '',
      next
        ? `<a class="related-btn" href="${next.url}" target="_blank" rel="noopener noreferrer">다음글: ${next.title} →</a>`
        : '',
      main
        ? `<a class="related-btn" href="${main.url}" target="_blank" rel="noopener noreferrer">전체 가이드 메인글 바로가기</a>`
        : '',
    ].filter(Boolean).join('\n')

    if (!buttons) return ''

    return `
<!-- INTERNAL_LINKS_START -->
<h2 class="wp-h2" id="internal-links">이전글·다음글 바로가기</h2>
<div class="related-button-box">
${buttons}
</div>
<!-- INTERNAL_LINKS_END -->`
  }

  const appendInternalLinks = (postHtml: string, linksBox: string) => {
    const cleaned = removeInternalLinksBox(postHtml)
    if (!linksBox) return cleaned

    const closingIndex = cleaned.lastIndexOf('</div>')
    if (closingIndex === -1) return `${cleaned}\n${linksBox}`

    return `${cleaned.slice(0, closingIndex)}\n${linksBox}\n${cleaned.slice(closingIndex)}`
  }

  const safeCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      console.warn('클립보드 자동 복사 실패')
      return false
    }
  }

  const checkAlreadyPublished = async (picked: Article[]) => {
    const logRes = await fetch('/api/publish-log')
    if (!logRes.ok) return false
    const logData = await logRes.json()

    return logData.logs?.some((log: any) =>
      picked.some(article => log.sourceLinks?.includes(article.link) || log.title?.trim() === article.title?.trim())
    )
  }

  const savePublishLog = async ({ title, url, sourceLinks = [] }: { title: string; url: string; sourceLinks?: string[] }) => {
    await fetch('/api/publish-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, sourceLinks }),
    })
  }

  const generateSinglePost = async (picked: Article[], plan: Plan, subLinks: { title: string; url: string }[] = []) => {
    const res = await fetch('/api/generate-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: picked, plan, subLinks }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `${plan.title} 생성 실패`)

    return {
      title: data.title || plan.title,
      html: data.html || '',
    }
  }

  const publishPost = async ({ title, html, accessToken }: { title: string; html: string; accessToken: string }) => {
    const res = await fetch('/api/blogger/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, html, accessToken }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `${title} 발행 실패`)
    if (!data.url) throw new Error(`${title} 발행 URL을 받지 못했습니다.`)

    return data
  }

  const updatePost = async ({ post, html, accessToken }: { post: PublishedPost; html: string; accessToken: string }) => {
    if (!post.id) return

    const res = await fetch('/api/blogger/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id, title: post.title, html, accessToken }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `${post.title} 업데이트 실패`)
  }

  const generateBlog = async () => {
    if (selected.size === 0) return

    setGenerating(true)
    setError('')
    setHtml('')
    setPublishedUrl('')
    setProgress('ChatGPT로 5개 글 기획 생성 중...')
    setProgressLog([])

    const picked = [...selected].map(i => articles[i])

    try {
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: picked }),
      })
      const planData = await planRes.json()
      if (!planRes.ok) throw new Error(planData.error || '기획 생성 실패')

      const plans: Plan[] = planData.plans
      let preview = `<!-- 5개 글 기획 완료 -->\n\n${plans.map(p => `${p.order}. [${p.type}] ${p.title} - ${p.focus}`).join('\n')}`

      for (const plan of plans) {
        addProgress(`${plan.order}/5 ${plan.title} 생성 중...`)
        const generated = await generateSinglePost(picked, plan)
        preview += `\n\n<!-- ${plan.type} ${plan.order}: ${generated.title} -->\n${generated.html}`
        setHtml(preview)
      }

      addProgress('미리보기 생성 완료')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  const handleGenerateAndPublish = async () => {
    if (selected.size === 0) return

    try {
      setOneClickPublishing(true)
      setGenerating(true)
      setPublishing(false)
      setError('')
      setHtml('')
      setPublishedUrl('')
      setProgressLog([])
      addProgress('Google 로그인 확인 중...')

      const session = await getSession()

      if (!session || !(session as any).accessToken) {
        await signIn('google')
        return
      }

      const accessToken = (session as any).accessToken as string
      const picked = [...selected].map(i => articles[i])

      addProgress('중복 발행 여부 확인 중...')
      const alreadyPublished = await checkAlreadyPublished(picked)
      if (alreadyPublished) throw new Error('이미 발행된 기사입니다. 다른 기사를 선택해주세요.')

      addProgress('1단계: 5개 글 제목/구성 생성 중...')
      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: picked }),
      })
      const planData = await planRes.json()
      if (!planRes.ok) throw new Error(planData.error || '5개 글 기획 실패')

      const plans: Plan[] = planData.plans
      const subPlans = plans.filter(p => p.type === 'sub').sort((a, b) => a.order - b.order)
      const mainPlan = plans.find(p => p.type === 'main')

      if (subPlans.length !== 4 || !mainPlan) {
        throw new Error('서브글 4개와 메인글 1개 기획이 필요합니다.')
      }

      setGenerating(false)
      setPublishing(true)

      const publishedSubs: PublishedPost[] = []
      let preview = `<!-- 기획 완료 -->\n${plans.map(p => `${p.order}. [${p.type}] ${p.title}`).join('\n')}\n\n`
      setHtml(preview)

      for (let i = 0; i < subPlans.length; i++) {
        const plan = subPlans[i]
        addProgress(`${i + 2}단계: 서브글 ${i + 1}/4 생성 중...`)
        const generated = await generateSinglePost(picked, plan)
        const subTitle = generated.title || plan.title || extractTitleFromHtml(generated.html)
        const subHtml = insertThumbnail(generated.html, subTitle)

        addProgress(`서브글 ${i + 1}/4 발행 중...`)
        const publishData = await publishPost({ title: subTitle, html: subHtml, accessToken })

        const post: PublishedPost = {
          id: publishData.id || '',
          type: 'sub',
          order: plan.order,
          title: subTitle,
          html: subHtml,
          url: publishData.url,
        }

        publishedSubs.push(post)

        await savePublishLog({ title: subTitle, url: publishData.url, sourceLinks: picked.map(a => a.link) })

        preview += `\n<!-- 서브글 ${i + 1} 발행 완료: ${subTitle} -->\n${publishData.url}\n`
        setHtml(preview)
      }

      addProgress('메인글 생성 중...')
      const mainGenerated = await generateSinglePost(
        picked,
        mainPlan,
        publishedSubs.map(p => ({ title: p.title, url: p.url }))
      )
      const mainTitle = mainGenerated.title || mainPlan.title || extractTitleFromHtml(mainGenerated.html)
      const mainHtml = insertThumbnail(mainGenerated.html, mainTitle)

      addProgress('메인글 발행 중...')
      const mainPublishData = await publishPost({ title: mainTitle, html: mainHtml, accessToken })

      const mainPost: PublishedPost = {
        id: mainPublishData.id || '',
        type: 'main',
        order: mainPlan.order,
        title: mainTitle,
        html: mainHtml,
        url: mainPublishData.url,
      }

      await savePublishLog({ title: mainTitle, url: mainPublishData.url, sourceLinks: picked.map(a => a.link) })

      addProgress('서브글 이전글/다음글/메인글 버튼 업데이트 중...')

      for (let i = 0; i < publishedSubs.length; i++) {
        const current = publishedSubs[i]
        const prev = publishedSubs[i - 1]
        const next = publishedSubs[i + 1]
        const linksBox = buildInternalLinksBox({ prev, next, main: mainPost })
        const updatedHtml = appendInternalLinks(current.html, linksBox)
        await updatePost({ post: current, html: updatedHtml, accessToken })
      }

      addProgress('완료: 메인글 URL 복사 및 새 탭 열기')
      setHtml(mainHtml)
      setPublishedUrl(mainPost.url)
      await safeCopyToClipboard(mainPost.url)
      window.open(mainPost.url, '_blank', 'noopener,noreferrer')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '생성 + 자동발행 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
      setPublishing(false)
      setOneClickPublishing(false)
      setProgress('')
    }
  }

  const copyHtml = async () => {
    const ok = await safeCopyToClipboard(html)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const formatDate = (str: string) => {
    if (!str) return ''
    const date = new Date(str)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('ko-KR')
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-16">
      <header className="bg-[#dc2626] text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl shrink-0">🦖</div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">정부 정책 블로그 · Blogspot Local v2</h1>
            <p className="text-xs sm:text-sm text-red-100 mt-0.5">기획 생성 → 서브글 순차 생성/발행 → 메인글 발행 → 내부링크 업데이트</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="font-semibold text-gray-800 text-sm sm:text-base">RSS 검색 설정</h2>
          </div>

          <label className="block text-xs font-medium text-gray-500 mb-1.5">RSS 주소</label>
          <textarea
           
  value={rssUrls}
  onChange={e => setRssUrls(e.target.value)}
  rows={3}
  className="w-full text-xs sm:text-sm font-mono border border-gray-200 rounded-2xl px-4 py-3 resize-none bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:bg-white transition-colors"
/>

<div className="flex flex-wrap gap-2 mt-3">
  <button type="button" onClick={() => applyPreset('policy')} className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
    정부정책
  </button>

  <button type="button" onClick={() => applyPreset('support')} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
    지원금
  </button>

  <button type="button" onClick={() => applyPreset('realestate')} className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
    부동산
  </button>

  <button type="button" onClick={() => applyPreset('news')} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
    세상뉴스
  </button>

  <button type="button" onClick={() => applyPreset('alerts')} className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
    구글알리미
  </button>
</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">키워드 필터</label>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchArticles()}
                className="w-full text-sm border border-gray-200 rounded-full px-5 py-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:bg-white transition-colors"
                placeholder="예: 청년, 복지, 주택, 일자리"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">정렬</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'latest' | 'oldest')} className="w-full sm:w-32 text-sm border border-gray-200 rounded-full px-5 py-2.5 bg-gray-50">
                <option value="latest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">결과 개수</label>
              <select value={resultCount} onChange={e => setResultCount(Number(e.target.value))} className="w-full sm:w-28 text-sm border border-gray-200 rounded-full px-5 py-2.5 bg-gray-50">
                {RESULT_COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}개</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={fetchArticles} disabled={loading} className="flex-1 sm:flex-none sm:px-8 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold py-2.5 rounded-full disabled:opacity-50 transition-colors">
              {loading ? '수집 중…' : '🔍 기사 수집'}
            </button>
            <button onClick={fetchArticles} disabled={loading} className="px-5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium py-2.5 rounded-full disabled:opacity-50 transition-colors">↻ 새로고침</button>
          </div>
        </section>

        {(progress || progressLog.length > 0) && (
          <section className="bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl px-4 py-3.5 text-sm">
            <p className="font-bold">🔄 {progress || '진행상태'}</p>
            {progressLog.length > 0 && (
              <div className="mt-2 space-y-1 text-xs text-blue-600">
                {progressLog.map((log, i) => <p key={`${log}-${i}`}>• {log}</p>)}
              </div>
            )}
          </section>
        )}

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl px-4 py-3.5">⚠️ {error}</div>}

        {articles.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="font-semibold text-gray-800 text-sm sm:text-base">기사 선택 <span className="text-gray-400 font-normal">({articles.length}건)</span></h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={toggleAll} className="px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50">{selected.size === articles.length ? '전체 해제' : '전체 선택'}</button>
                <button onClick={generateBlog} disabled={selected.size === 0 || generating || oneClickPublishing} className="px-5 py-2 rounded-full bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-colors">
                  {generating && !oneClickPublishing ? 'ChatGPT로 작성 중…' : `✨ 선택한 ${selected.size}개 기사로 미리보기 생성`}
                </button>
                <button onClick={handleGenerateAndPublish} disabled={selected.size === 0 || oneClickPublishing || generating || publishing} className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-colors">
                  {oneClickPublishing ? '순차 생성 + 자동발행 중…' : '🚀 순차 생성 + 자동발행'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[720px] overflow-y-auto pr-1">
              {articles.map((a, i) => {
                const dateText = formatDate(a.pubDate)
                return (
                  <label key={i} className={`relative flex min-h-[230px] cursor-pointer select-none flex-col rounded-3xl border bg-white p-5 shadow-sm transition-all ${selected.has(i) ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-100 hover:border-red-200 hover:shadow-md'}`}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">내용 편집</span>
                      <span className="text-xs text-gray-400 shrink-0">{a.source || '정부 정책'}</span>
                    </div>
                    <p className="text-base font-extrabold leading-snug text-gray-900">{a.title}</p>
                    <p className="mt-2 text-xs font-medium text-gray-500">{a.source || '정책뉴스'}{dateText ? ` · ${dateText}` : ''}</p>
                    {a.summary && <p className="mt-4 text-sm leading-6 text-gray-600">{a.summary.length > 150 ? `${a.summary.slice(0, 150)}...` : a.summary}</p>}
                    <div className="mt-auto flex items-center justify-between pt-5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)} className="accent-red-600" />선택
                      </div>
                      {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs font-bold text-blue-600 hover:underline">원문 보기</a>}
                    </div>
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {html && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">3</span>
                <h2 className="font-semibold text-gray-800 text-sm sm:text-base">생성된 HTML / 발행 로그</h2>
              </div>
              <button onClick={copyHtml} className={`text-sm font-semibold px-4 py-2 rounded-full transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                {copied ? '✓ 복사 완료!' : '📋 HTML 복사'}
              </button>
            </div>

            {publishedUrl && (
              <div className="mb-4 p-4 rounded-2xl bg-green-50 border border-green-200">
                <p className="text-sm text-green-700 font-bold mb-1">✅ Blogger 발행 완료 · 메인글 URL 자동 복사 완료</p>
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">{publishedUrl}</a>
              </div>
            )}

            <pre className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap">{html}</pre>
          </section>
        )}
      </main>
    </div>
  )
}
