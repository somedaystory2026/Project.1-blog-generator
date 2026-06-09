import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const logPath = path.join(process.cwd(), 'data', 'publish-log.json')

function ensureFile() {
  const dir = path.dirname(logPath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '[]', 'utf-8')
  }
}

export async function GET() {
  ensureFile()

  const logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'))

  return NextResponse.json({ logs })
}

export async function POST(req: NextRequest) {
  ensureFile()

  const body = await req.json()
  const logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'))

  const exists = logs.some(
    (item: any) =>
      item.title?.trim() === body.title?.trim() ||
      item.url === body.url ||
      body.sourceLinks?.some((link: string) =>
        item.sourceLinks?.includes(link)
      )
  )

  if (!exists) {
    logs.unshift({
      title: body.title,
      url: body.url,
      date: new Date().toISOString(),
      sourceLinks: body.sourceLinks || [],
    })

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8')
  }

  return NextResponse.json({ success: true, exists, logs })
}