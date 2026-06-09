import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '정부 정책 블로그 생성기',
  description: '정부 RSS에서 SEO 블로그 글을 자동 생성합니다',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}