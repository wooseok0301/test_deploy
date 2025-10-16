'use client'

import Link from 'next/link'
import styles from './Hero.module.css'

interface HeroProps {
  userName?: string
}

export default function Hero({ userName }: HeroProps) {
  return (
    <section className={styles.hero} aria-label="메인 히어로">
      <div className={styles.inner}>
        <div>
          <div className={styles.eyebrow}>
            <span className={styles.dot} />
            CLIX 커뮤니티 아카이브
          </div>
          <h1 className={styles.heading}>
            {userName ? `${userName}님, 환영합니다.` : 'CLIX 프로젝트 아카이브'}
          </h1>
          <p className={styles.subheading}>
            CLIX는 졸업작품을 공유하고, 동료들의 피드백으로 더 나은 결과물을
            만들어가는 학생 중심 커뮤니티입니다. 기수를 넘어 작품을 통해
            연결되고, 배움의 폭을 넓혀보세요.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/upload" className={styles.primaryCta}>
              프로젝트 업로드
            </Link>
            <Link href="/yearly" className={styles.secondaryCta}>
              연도별 보기
            </Link>
          </div>
        </div>
        <div className={styles.mediaBox}>
          <img
            src="/logo.png"
            alt="CLIX 로고"
            className={styles.previewImage}
          />
        </div>
      </div>
    </section>
  )
}
