// /app/yearly/page.tsx
import { Suspense } from "react"
import YearlyPageClient from "./YearlyPageClient"

export default function Page() {
  return (
    
    <Suspense fallback={<div>로딩 중...</div>}>
      <YearlyPageClient />
    </Suspense>
  )
}
