// /app/search/page.tsx
import { Suspense } from "react"
import SearchPageClient from "./SearchPageClient"

export default function Page() {
  return (
    <Suspense fallback={<div>검색 페이지 로딩 중...</div>}>
      <SearchPageClient />
    </Suspense>
  )
}