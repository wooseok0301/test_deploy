import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from './components/Header'
import Footer from './components/Footer'
import { Toaster } from 'react-hot-toast' //추가된 코드

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clix',
  description: '프로젝트 공유 플랫폼',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Header />
        <main>{children}</main>
        <Footer />
        <Toaster /> //추가된 코드
      </body>
    </html>
  )
}
