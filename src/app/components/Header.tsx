'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  where,
  limit,
} from 'firebase/firestore'
import styles from './Header.module.css'

interface UserData {
  name: string
  role?: 'admin' | 'subAdmin' | 'user'
}

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState<string>('')
  const [userRole, setUserRole] = useState<
    'admin' | 'subAdmin' | 'user' | null
  >(null)
  const [years, setYears] = useState<string[]>([])
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [userMenuTimer, setUserMenuTimer] = useState<NodeJS.Timeout | null>(
    null
  )
  const [yearMenuTimer, setYearMenuTimer] = useState<NodeJS.Timeout | null>(
    null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  // 게시물 업로드 가능 여부 상태 추가
  const [postUploadEnabled, setPostUploadEnabled] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setUser(user)
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserData
          setUserName(userData.name)
          setUserRole(userData.role || 'user')
        }
      }
    })

    const fetchYears = async () => {
      try {
        // 가장 오래된 게시물의 연도 찾기
        const oldestSnap = await getDocs(
          query(collection(db, 'posts'), orderBy('createdAt', 'asc'), limit(1))
        )

        if (oldestSnap.empty) {
          setYears([])
          return
        }

        const oldestDoc = oldestSnap.docs[0]
        const oldestDate = oldestDoc.data().createdAt?.toDate?.() || new Date()
        const oldestYear = oldestDate.getFullYear()

        const currentYear = new Date().getFullYear()
        const yearSet = new Set<string>()

        // oldestYear..currentYear 범위 내에서 해당 연도에 게시물이 하나라도 있으면 추가
        for (let year = currentYear; year >= oldestYear; year--) {
          try {
            const startDate = new Date(year, 0, 1)
            const endDate = new Date(year + 1, 0, 1)

            const q = query(
              collection(db, 'posts'),
              where('createdAt', '>=', startDate),
              where('createdAt', '<', endDate),
              limit(1)
            )
            const snapshot = await getDocs(q)
            if (!snapshot.empty) {
              yearSet.add(year.toString())
            }
          } catch (error) {
            console.error(`${year}년 게시물 조회 실패:`, error)
          }
        }

        setYears(Array.from(yearSet).sort((a, b) => Number(b) - Number(a)))
      } catch (error) {
        console.error('연도 목록 로딩 중 오류:', error)
      }
    }

    // `settings/config` 문서의 변경 사항을 실시간으로 구독
    const settingsDocRef = doc(db, 'settings', 'config')
    const unsubscribeSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setPostUploadEnabled(docSnap.data().postUploadEnabled || false)
        } else {
          // 문서가 없으면 기본적으로 비활성화 또는 처리
          setPostUploadEnabled(false)
        }
      },
      (error) => {
        console.error('Error fetching settings: ', error)
        // 에러 발생 시 기본적으로 비활성화
        setPostUploadEnabled(false)
      }
    )

    fetchYears()
    return () => {
      unsubscribeAuth()
      unsubscribeSettings() // 구독 해제
      if (userMenuTimer) clearTimeout(userMenuTimer)
      if (yearMenuTimer) clearTimeout(yearMenuTimer)
    }
  }, [userMenuTimer, yearMenuTimer])

  const handleLogout = async () => {
    try {
      await auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('로그아웃 중 오류 발생:', error)
    }
  }

  const handleYearClick = (year: string) => {
    router.push(`/yearly?year=${year}`)
    setIsYearMenuOpen(false)
  }

  const handleUserMenuEnter = () => {
    if (userMenuTimer) {
      clearTimeout(userMenuTimer)
      setUserMenuTimer(null)
    }
    setIsUserMenuOpen(true)
  }

  const handleUserMenuLeave = () => {
    const timer = setTimeout(() => {
      setIsUserMenuOpen(false)
    }, 300) // 0.3초 지연
    setUserMenuTimer(timer)
  }

  const handleAdminClick = () => {
    router.push('/admin')
    setIsUserMenuOpen(false)
  }

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleYearMenuEnter = () => {
    if (yearMenuTimer) {
      clearTimeout(yearMenuTimer)
      setYearMenuTimer(null)
    }
    setIsYearMenuOpen(true)
  }

  const handleYearMenuLeave = () => {
    const timer = setTimeout(() => {
      setIsYearMenuOpen(false)
    }, 300) // 0.3초 지연
    setYearMenuTimer(timer)
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.logo}>
          Clix
        </Link>
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="프로젝트 및 기술태그 검색"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
          <button onClick={handleSearch} className={styles.searchButton}>
            검색
          </button>
        </div>
        <nav className={styles.nav}>
          <div
            className={styles.yearNavItem}
            onMouseEnter={handleYearMenuEnter}
            onMouseLeave={handleYearMenuLeave}
          >
            <span
              className={`${styles.navItem} ${
                pathname === '/yearly' ? styles.active : ''
              }`}
            >
              연도별
            </span>
            {isYearMenuOpen && (
              <div
                className={styles.yearDropdown}
                onMouseEnter={handleYearMenuEnter}
                onMouseLeave={handleYearMenuLeave}
              >
                {years.map((year) => (
                  <button
                    key={year}
                    className={styles.yearOption}
                    onClick={() => handleYearClick(year)}
                  >
                    {year}년
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/hall-of-fame"
            className={`${styles.navItem} ${
              pathname === '/hall-of-fame' ? styles.active : ''
            }`}
          >
            명예의 전당
          </Link>
          <Link
            href="/team"
            className={`${styles.navItem} ${
              pathname === '/team' ? styles.active : ''
            }`}
          >
            팀원 소개
          </Link>
        </nav>
        <div className={styles.authSection}>
          {user ? (
            <div
              className={styles.userMenu}
              onMouseEnter={handleUserMenuEnter}
              onMouseLeave={handleUserMenuLeave}
            >
              <button className={styles.userNameButton}>
                {userName}
                {(userRole === 'admin' || userRole === 'subAdmin') && (
                  <span className={styles.adminBadge}>관리자</span>
                )}
              </button>
              {isUserMenuOpen && (
                <div
                  className={styles.userDropdown}
                  onMouseEnter={handleUserMenuEnter}
                  onMouseLeave={handleUserMenuLeave}
                >
                  <Link href="/mypage" className={styles.userMenuItem}>
                    마이페이지
                  </Link>
                  {/* postUploadEnabled 값에 따라 조건부 렌더링 */}
                  {postUploadEnabled && (
                    <Link href="/upload" className={styles.userMenuItem}>
                      프로젝트 업로드
                    </Link>
                  )}
                  {(userRole === 'admin' || userRole === 'subAdmin') && (
                    <Link href="/admin" className={styles.userMenuItem}>
                      관리자 페이지
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className={styles.userMenuItem}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginButton}>
                로그인
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
