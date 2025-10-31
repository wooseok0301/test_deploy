'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/firebase/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  increment,
  where,
  limit,
  startAfter,
} from 'firebase/firestore'
import Link from 'next/link'
import styles from './page.module.css'
import { toast } from 'react-hot-toast'
import Hero from './components/Hero'

interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  detailImages?: string[]
  author: {
    name: string
    email: string
  }
  createdAt: {
    toDate: () => Date
  }
  likes: string[]
  views: number
  teamName?: string
  teamMembers?: {
    name: string
    role: string
    githubLink?: string
    portfolioLink?: string
  }[]
  techStack?: string[]
}

interface Banner {
  id: string
  imageUrl: string
  position: 'right'
  isActive: boolean
  order: number
  year?: string
}


interface PopupItem {
  imageUrl: string
  title: string
  description: string
  link: string 
}


const POPUP_DATA: PopupItem[] = [
  {
    imageUrl: '/popup4.png',
    title: '2025년 제21회 정보보호학과 졸업작품전시회',
    description: '행사 진행 11/4 ~ 11/5',
    link: '/yearly?year=2025', 
  },
  {
    imageUrl: '/popup2.png',
    title: '2025년 제21회 정보보호학과 졸업작품전시회',
    description: '행사 진행 11/4 ~ 11/5',
    link: '/yearly?year=2025', 
  },
  {
    imageUrl: '/popup3.png',
    title: '2025년 제21회 정보보호학과 졸업작품전시회',
    description: '행사 진행 11/4 ~ 11/5',
    link: '/yearly?year=2025', 
  },
  {
    imageUrl: '/popup5.png',
    title: '재학생 참여 이벤트',
    description: '본 서비스는 4학년 졸업작품 프로젝트팀과 \n재학생들간의 교류를 증진하기 위해 만들어졌습니다. \n회원가입 하시고 좋아요와 댓글로 많은 참여 바랍니다. \n가장 많은 좋아요, 댓글을 받아 명예의 전당에 선정된 3팀에게 학과장상을 시상합니다. \n정성스런 댓글을 작성한 3명을 선정하여 문화상품권을 증정합니다',
    link: '/event', 
  },
    {
    imageUrl: '/popup1.png',
    title: '졸업 작품 업로드',
    description: '11월2일까지 업로드 해주세요. 클릭시 이동됩니다',
    link: '/upload', 
  },
]

const POPUP_LOCAL_STORAGE_KEY = 'hideMainPagePopupsUntil'

export default function Home() {
  const router = useRouter()
  const [loadingPosts, setLoadingPosts] = useState(true) // 게시물 로딩 전용 상태 추가
  const [posts, setPosts] = useState<Post[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userDisplayName, setUserDisplayName] = useState<string | undefined>(
    undefined
  )
  const [banners, setBanners] = useState<Banner[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const POSTS_PER_PAGE = 9

  // 팝업 관련 상태
  const [showPopup, setShowPopup] = useState(false)
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0) // 이미지 인덱스 대신 팝업 데이터 인덱스

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          setCurrentUser(user)
          const data = userSnap.data() as any
          setUserDisplayName(
            (data && (data.name || data.displayName)) ||
              user.email.split('@')[0]
          )
        } else {
          setCurrentUser(user)
          setUserDisplayName(user.email.split('@')[0])
        }
      } else {
        setCurrentUser(null)
        setUserDisplayName(undefined)
      }
    })

    return () => unsubscribe()
  }, [router])

  // 팝업 표시 로직
  useEffect(() => {
    const hideUntil = localStorage.getItem(POPUP_LOCAL_STORAGE_KEY)
    if (hideUntil) {
      const hideTimestamp = parseInt(hideUntil, 10)
      if (Date.now() < hideTimestamp) {
        setShowPopup(false)
        return
      }
    }
    // 24시간이 지났거나, 설정된 적이 없으면 팝업 표시
    if (POPUP_DATA.length > 0) { // POPUP_IMAGES 대신 POPUP_DATA 확인
      setShowPopup(true)
    }
  }, [])

  const handleClosePopup = () => {
    setShowPopup(false)
  }

  const handleHidePopupFor24Hours = () => {
    const twentyFourHours = 24 * 60 * 60 * 1000 // 24시간 밀리초
    const hideUntilTimestamp = Date.now() + twentyFourHours
    localStorage.setItem(
      POPUP_LOCAL_STORAGE_KEY,
      hideUntilTimestamp.toString()
    )
    setShowPopup(false)
    toast.success('24시간 동안 팝업이 나타나지 않습니다.')
  }

  const handleNextPopup = () => {
    setCurrentPopupIndex((prevIndex) =>
      prevIndex === POPUP_DATA.length - 1 ? 0 : prevIndex + 1
    )
  }

  const handlePrevPopup = () => {
    setCurrentPopupIndex((prevIndex) =>
      prevIndex === 0 ? POPUP_DATA.length - 1 : prevIndex - 1
    )
  }

  const handlePopupClick = (link: string) => {
    router.push(link)
    setShowPopup(false) // 팝업 클릭 시 닫기
  }

  // 게시물 불러오기
  const fetchPosts = async (isInitial: boolean = false) => {
    if (isInitial) {
      setLoadingPosts(true) // 게시물 로딩 시작
    } else {
      setLoadingMore(true)
    }
    try {
      let q
      if (isInitial) {
        q = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(POSTS_PER_PAGE)
        )
      } else {
        q = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(POSTS_PER_PAGE)
        )
      }

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        setHasMore(false)
        setShowLoadMoreButton(false)
        if (isInitial) setPosts([]) // 초기 로드 시 게시물이 없으면 빈 배열로 설정
        return
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1])

      const postsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const postData = docSnapshot.data() as any

          // 댓글 수 가져오기 (필요하다면 추가)
          const commentsSnapshot = await getDocs(
            collection(db, 'posts', docSnapshot.id, 'comments')
          )
          const commentsCount = commentsSnapshot.size

          return {
            id: docSnapshot.id,
            ...postData,
            author: {
              name: postData.author?.name || '익명',
              email: postData.author?.email || 'unknown',
            },
            likes: postData.likes || [],
            views: postData.views || 0,
            comments: commentsCount,
          } as Post
        })
      )

      setPosts((prevPosts) =>
        isInitial ? postsData : [...prevPosts, ...postsData]
      )

      if (isInitial) {
        setShowLoadMoreButton(postsData.length === POSTS_PER_PAGE)
      }
    } catch (error) {
      console.error('게시물 로딩 중 오류:', error)
      toast.error('게시물을 불러오는 중 오류가 발생했습니다.')
    } finally {
      if (isInitial) {
        setLoadingPosts(false) // 게시물 로딩 완료
      } else {
        setLoadingMore(false)
      }
    }
  }

  // 초기 게시물 로드
  useEffect(() => {
    fetchPosts(true)
  }, [])

  // 수동으로 더 많은 게시물 로드
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      await fetchPosts(false)
    } finally {
      setLoadingMore(false)
    }
  }

  // 스크롤 이벤트 리스너 추가 (intersection observer로 대체 가능, 여기서는 기존 로직 유지)
  useEffect(() => {
    const handleScroll = () => {
      if (showLoadMoreButton && !loadingMore && hasMore) {
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop
        const windowHeight = window.innerHeight
        const documentHeight = document.documentElement.scrollHeight

        if (scrollTop + windowHeight >= documentHeight - 100) {
          // 스크롤이 하단에 가까워지면 '더보기' 버튼을 표시 (또는 자동 로드 트리거)
          // 여기서는 버튼을 표시하는 대신, 스크롤이 감지되면 자동으로 로드하도록 변경할 수도 있습니다.
          // 현재 로직은 showLoadMoreButton이 true일 때만 작동하며, 이미 true라면 추가적인 동작은 없습니다.
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showLoadMoreButton, loadingMore, hasMore])

  // 배너 불러오기
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const bannersRef = collection(db, 'banners')
        const q = query(
          bannersRef,
          where('isActive', '==', true),
          where('position', '==', 'right')
        )

        const querySnapshot = await getDocs(q)
        const bannersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Banner[]

        const mainPageBanners = bannersData.filter((banner) => !banner.year)
        setBanners(mainPageBanners.sort((a, b) => a.order - b.order))
      } catch (error) {
        console.error('배너 로딩 중 오류:', error)
      }
    }

    fetchBanners()
  }, [])

  const handleView = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId)
      await updateDoc(postRef, {
        views: increment(1),
      })

      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              views: post.views + 1,
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('조회수 업데이트 중 오류:', error)
    }
  }

  const handleLike = async (
    postId: string,
    likes: string[],
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentUser?.email) {
      toast.error('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    try {
      const postRef = doc(db, 'posts', postId)
      const newLikes = likes.includes(currentUser.email)
        ? likes.filter((email) => email !== currentUser.email)
        : [...likes, currentUser.email]

      await updateDoc(postRef, {
        likes: newLikes,
      })

      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              likes: newLikes,
            }
          }
          return post
        })
      )

      toast.success(
        newLikes.includes(currentUser.email)
          ? '좋아요를 눌렀습니다.'
          : '좋아요를 취소했습니다.'
      )
    } catch (error) {
      console.error('좋아요 처리 중 오류:', error)
      toast.error('좋아요 처리 중 오류가 발생했습니다.')
    }
  }

  const currentPopup = POPUP_DATA[currentPopupIndex];

  return (
    <div className={styles.container}>
      {showPopup && POPUP_DATA.length > 0 && currentPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupContent}>
            <div className={styles.popupHeader}>
              <h2 className={styles.popupTitle}>{currentPopup.title}</h2>
            </div>
            {/* 이미지 클릭 시 링크 이동 */}
            <a href={currentPopup.link} onClick={(e) => {
                e.preventDefault(); // 기본 링크 이동 방지
                handlePopupClick(currentPopup.link);
              }}>
              <img
                src={currentPopup.imageUrl}
                alt={currentPopup.title}
                className={styles.popupImage}
              />
            </a>
            <p className={styles.popupDescription}>{currentPopup.description}</p>
            
            {POPUP_DATA.length > 1 && (
              <>
                <button
                  className={styles.popupNavButtonLeft}
                  onClick={handlePrevPopup}
                >
                  &lt;
                </button>
                <button
                  className={styles.popupNavButtonRight}
                  onClick={handleNextPopup}
                >
                  &gt;
                </button>
              </>
            )}
            <div className={styles.popupActions}>
              <button onClick={handleHidePopupFor24Hours}>
                24시간 동안 다시 보지 않기
              </button>
              <button onClick={handleClosePopup}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <Hero userName={userDisplayName} />
      <div className={styles.contentColumnsWrapper}>
        <div className={styles.leftSpace} />
        <div className={styles.mainContent}>
          <div className={styles.postsGrid}>
            {loadingPosts ? (
              <p>게시물을 불러오는 중입니다.</p>
            ) : posts.length === 0 ? (
              <p>표시할 게시물이 없습니다.</p>
            ) : (
              posts.map((post, index) => (
                <div key={post.id} className={styles.card}>
                  <div className={styles.imageContainer}>
                    <Link
                      href={`/post/${post.id}`}
                      onClick={() => handleView(post.id)}
                    >
                      {post.thumbnailUrl ? (
                        <img
                          src={post.thumbnailUrl}
                          alt={post.title}
                          className={styles.cardImage}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          <span>이미지 없음</span>
                        </div>
                      )}
                    </Link>
                  </div>
                  <div className={styles.cardContent}>
                    <h3>{post.title}</h3>
                    <div className={styles.cardInfo}>
                      <span>팀명: {post.teamName || '미지정'}</span>
                      <span>작성자: {post.author.name}</span>
                      {post.teamMembers &&
                        post.teamMembers.length > 0 &&
                        (() => {
                          const professors = post.teamMembers.filter(
                            (member) => member.role === '지도교수'
                          )
                          return professors.length > 0 ? (
                            <span>
                              지도교수:{' '}
                              {professors.map((p) => p.name).join(', ')}
                            </span>
                          ) : null
                        })()}
                      {post.techStack && post.techStack.length > 0 && (
                        <div className={styles.techStackContainer}>
                          <div className={styles.techStackList}>
                            {post.techStack.slice(0, 3).map((tech, index) => (
                              <span
                                key={index}
                                className={styles.techStackItem}
                              >
                                #{tech}
                              </span>
                            ))}
                            {post.techStack.length > 3 && (
                              <span className={styles.techStackMore}>+</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.cardStats}>
                        <button
                          className={`${styles.likeButton} ${
                            post.likes.includes(currentUser?.email || '')
                              ? styles.liked
                              : ''
                          }`}
                          onClick={(e) => handleLike(post.id, post.likes, e)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={
                              post.likes.includes(currentUser?.email || '')
                                ? '#ff4d4d'
                                : 'none'
                            }
                            stroke="currentColor"
                            strokeWidth="2"
                            className={styles.heartIcon}
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span>{post.likes.length}</span>
                        </button>
                        <span className={styles.views}>
                          조회수: {post.views.toLocaleString()}
                        </span>
                        <span className={styles.createdAt}>
                          {post.createdAt.toDate().toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 게시물 더보기 버튼 */}
          {showLoadMoreButton && (
            <div className={styles.loadMoreContainer}>
              <button
                className={styles.loadMoreSmallButton}
                onClick={handleLoadMore}
                disabled={loadingMore || !hasMore}
              >
                {loadingMore ? '로딩 중...' : '게시물 더보기↓'}
              </button>
            </div>
          )}
        </div>
        <div className={styles.rightBanner}>
          {banners.map((banner) => (
            <img
              key={banner.id}
              src={banner.imageUrl}
              alt="배너"
              className={styles.bannerImage}
            />
          ))}
        </div>
      </div>
    </div>
  )
}