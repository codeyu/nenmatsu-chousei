import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Sidebar } from '@/components/layout/sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '年末調整 給与所得金額計算ツール',
  description: '給与の収入金額に対する所得金額を計算するツールです。',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Sidebar>{children}</Sidebar>
      </body>
    </html>
  )
}

