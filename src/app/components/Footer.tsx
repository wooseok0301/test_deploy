'use client'

import Link from 'next/link'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>CLIX 커뮤니티 아카이브</h3>
          <p className={styles.footerText}>
            중부대학교 CLIX는 졸업작품을 공유하고 <br/>동료들의 피드백으로 더 나은 결과물을 <br/>만들어가는 학생 중심 커뮤니티입니다. <br/>기수를 넘어 작품을 통해 연결되고<br/>배움의 폭을 넓혀보세요.
          </p>
        </div>

        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>프로젝트</h3>
          <ul className={styles.footerLinks}>
            <li><Link href="/upload" className={styles.link}>프로젝트 업로드</Link></li>
            <li><Link href="/hall-of-fame" className={styles.link}>명예의 전당</Link></li>
            <li><Link href="/yearly" className={styles.link}>연도별 보기</Link></li>
          </ul>
        </div>



        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>관련 링크</h3>
          <ul className={styles.footerLinks}>
            <li><a href="https://www.joongbu.ac.kr/" target="_blank" rel="noopener noreferrer" className={styles.link}>중부대학교</a></li>
            <li><a href="https://www.joongbu.ac.kr/is/" target="_blank" rel="noopener noreferrer" className={styles.link}>정보보호학전공</a></li>
          </ul>
        </div>
      </div>
      <div className={styles.copyrightBar}>
        <p>© 2025 CLIX Archive. Powered by Joongbu University Students</p>
      </div>
    </footer>
  )
}