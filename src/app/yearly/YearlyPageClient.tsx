'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/firebase'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'
import { onAuthStateChanged } from 'firebase/auth'
import { toast } from 'react-hot-toast'

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

// PhotoAlbumEntry 인터페이스
interface PhotoAlbumEntry {
  id: string
  links: string[] // 'links' 배열을 가집니다.
}

// PhotoAlbum 인터페이스
interface PhotoAlbum {
  id: string // 문서 ID
  year: string
  albums: PhotoAlbumEntry[] // 여러 앨범 항목 (각각 ID와 링크 배열을 가짐)
  createdAt: {
    toDate: () => Date
  }
}

interface YearMeta {
  title?: string
  headProfessor?: string
  advisors?: string
  committee?: string
  president?: string
  color?: string
  textColor?: string
}

export default function YearlyPageClient() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showLoadMoreButton, setShowLoadMoreButton] = useState(false)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [banners, setBanners] = useState<Banner[]>([])
  const [selectedYearPhotoAlbums, setSelectedYearPhotoAlbums] = useState<PhotoAlbumEntry[]>([])
  const [yearMeta, setYearMeta] = useState<YearMeta>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const POSTS_PER_PAGE = 9

  // --- New state for image modal ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentModalImage, setCurrentModalImage] = useState('')
  // --- End new state ---

  // Ref for the scrolling tracks to control animation-play-state
  const track1Ref = useRef<HTMLDivElement>(null);
  const track2Ref = useRef<HTMLDivElement>(null);


  // 로그인 상태 확인 (currentUser 설정)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
    })
    return () => unsubscribe()
  }, [])

  // 연도 목록 가져오기
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const postsRef = collection(db, 'posts')
        const q = query(postsRef, orderBy('createdAt', 'desc'))
        const querySnapshot = await getDocs(q)

        const yearSet = new Set<string>()
        querySnapshot.docs.forEach((doc) => {
          const year = doc.data().createdAt.toDate().getFullYear().toString()
          yearSet.add(year)
        })

        const yearsArray = Array.from(yearSet).sort(
          (a, b) => Number(b) - Number(a)
        )
        setYears(yearsArray)

        const yearFromUrl = searchParams.get('year')
        if (yearFromUrl && yearsArray.includes(yearFromUrl)) {
          setSelectedYear(yearFromUrl)
        } else if (yearsArray.length > 0) {
          setSelectedYear(yearsArray[0])
        }
      } catch (error) {
        console.error('연도 목록 로딩 중 오류:', error)
      }
    }

    fetchYears()
  }, [searchParams])

  // 배너 불러오기
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const bannersRef = collection(db, 'banners')
        let q

        if (selectedYear) {
          q = query(
            bannersRef,
            where('isActive', '==', true),
            where('position', '==', 'right'),
            where('year', '==', selectedYear)
          )
        } else {
          q = query(
            bannersRef,
            where('isActive', '==', true),
            where('position', '==', 'right')
          )
        }

        const querySnapshot = await getDocs(q)
        const bannersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Banner[]

        setBanners(bannersData.sort((a, b) => a.order - b.order))
      } catch (error) {
        console.error('배너 로딩 중 오류:', error)
      }
    }

    fetchBanners()
  }, [selectedYear])

  // 포토앨범 데이터 가져오기 (배열로 변경)
  useEffect(() => {
    const fetchPhotoAlbums = async () => {
      if (!selectedYear) {
        setSelectedYearPhotoAlbums([]);
        return;
      }

      try {
        const photoAlbumsRef = collection(db, 'photoAlbums')
        const q = query(photoAlbumsRef, where('year', '==', selectedYear))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          const photoAlbumDoc = querySnapshot.docs[0]
          const photoAlbumData = photoAlbumDoc.data() as PhotoAlbum
          // PhotoAlbumData의 albums 필드 (PhotoAlbumEntry 배열)를 상태에 저장
          // 각 albumEntry는 { id: string, links: string[] } 형태
          setSelectedYearPhotoAlbums(photoAlbumData.albums || [])
        } else {
          setSelectedYearPhotoAlbums([])
        }
      } catch (error) {
        console.error('포토앨범 데이터 로딩 중 오류:', error)
        setSelectedYearPhotoAlbums([])
      }
    }

    fetchPhotoAlbums()
  }, [selectedYear])

  // yearMetas 컬렉션에서 상단 정보 가져오기
  useEffect(() => {
    const fetchYearMeta = async () => {
      if (!selectedYear) return
      try {
        const yearMetasRef = collection(db, 'yearMetas')
        const q = query(yearMetasRef, where('year', '==', selectedYear))
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data()
          setYearMeta({
            title: data.title || '',
            headProfessor: data.headProfessor || '',
            advisors: data.advisors || '',
            committee: data.committee || '',
            president: data.president || '',
            color: data.color || '#fde1e4',
            textColor: data.textColor || '#7a2327',
          })
        } else {
          setYearMeta({})
        }
      } catch (e) {
        setYearMeta({})
      }
    }
    fetchYearMeta()
  }, [selectedYear])

  // 선택된 연도의 게시물 가져오기
  const fetchPosts = async (isInitial: boolean = false) => {
    if (!selectedYear) return

    if (isInitial) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const startDate = new Date(Number(selectedYear), 0, 1)
      const endDate = new Date(Number(selectedYear) + 1, 0, 1)

      let q
      if (isInitial) {
        q = query(
          collection(db, 'posts'),
          where('createdAt', '>=', startDate),
          where('createdAt', '<', endDate),
          orderBy('createdAt', 'desc'),
          limit(POSTS_PER_PAGE)
        )
      } else {
        q = query(
          collection(db, 'posts'),
          where('createdAt', '>=', startDate),
          where('createdAt', '<', endDate),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(POSTS_PER_PAGE)
        )
      }

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        setHasMore(false)
        setShowLoadMoreButton(false)
        if (isInitial) setPosts([]);
        return
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1])

      const postsData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const postData = docSnapshot.data() as any
          return {
            id: docSnapshot.id,
            ...postData,
            author: {
              name: postData.author?.name || '익명',
              email: postData.author?.email || 'unknown',
            },
            likes: postData.likes || [],
            views: postData.views || 0,
          } as Post
        })
      )

      setPosts((prevPosts) =>
        isInitial ? postsData : [...prevPosts, ...postsData]
      )

      if (postsData.length < POSTS_PER_PAGE) {
        setHasMore(false);
        setShowLoadMoreButton(false);
      } else {
        setShowLoadMoreButton(true);
      }

    } catch (error) {
      console.error('게시물 로딩 중 오류:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // 선택된 연도가 변경될 때 게시물 다시 로드
  useEffect(() => {
    if (selectedYear) {
      setPosts([])
      setLastDoc(null)
      setHasMore(true)
      setShowLoadMoreButton(false)
      fetchPosts(true)
    }
  }, [selectedYear])

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

  useEffect(() => {
    const handleScroll = () => {
      if (showLoadMoreButton && !loadingMore && hasMore) {
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop
        const windowHeight = window.innerHeight
        const documentHeight = document.documentElement.scrollHeight

        if (scrollTop + windowHeight >= documentHeight - 300) {
          // This scroll logic is fine if you want automatic loading when near the bottom.
          // If you *only* want button clicks, remove this.
          // For now, it won't *auto-trigger* fetchPosts(false) if the button is the intended interaction.
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showLoadMoreButton, loadingMore, hasMore])


  // 좋아요 처리 함수 추가
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

  // 조회수 처리 함수 추가
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

  // --- New functions for image modal ---
  const openModal = (imageUrl: string) => {
    setCurrentModalImage(imageUrl)
    setIsModalOpen(true)
    document.body.style.overflow = 'hidden' // Prevent scrolling when modal is open
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setCurrentModalImage('')
    document.body.style.overflow = 'unset' // Re-enable scrolling
  }
  // --- End new functions ---

  // Function to render photo album items, adjusted for conditional duplication
  const renderPhotoAlbumItems = (items: string[], isDuplicated: boolean) => {
    const itemsToRender = isDuplicated ? [...items, ...items] : items;
    return itemsToRender.map((link, index) => (
      <div
        key={`album-image-${index}`}
        className={styles.photoAlbumLinkItem}
        onClick={() => openModal(link)}
      >
        <img
          src={link}
          alt={`Photo Album Image ${index + 1}`}
          className={styles.photoAlbumImage}
        />
      </div>
    ));
  };

  // Logic to split photo album links into two rows
  const allPhotoLinks = selectedYearPhotoAlbums.flatMap(albumEntry => albumEntry.links || []);
  
  // Conditional rendering based on the number of photo links
  const showSingleRow = allPhotoLinks.length <= 5; // You can adjust this threshold
  const showAnimatedScroll = allPhotoLinks.length > 5; // Enable animation for more items

  let firstHalfLinks: string[] = [];
  let secondHalfLinks: string[] = [];

  if (showSingleRow) {
    firstHalfLinks = allPhotoLinks;
  } else {
    const midPoint = Math.ceil(allPhotoLinks.length / 2);
    firstHalfLinks = allPhotoLinks.slice(0, midPoint);
    secondHalfLinks = allPhotoLinks.slice(midPoint);
  }


  return (
    <div className={styles.container}>
      {yearMeta.title && (
        <div
          className={styles.metaHeader}
          style={{
            background: yearMeta.color || '#fde1e4',
          }}
        >
          <h1
            className={styles.metaTitle}
            style={{ color: yearMeta.textColor || '#7a2327' }}
          >
            {yearMeta.title &&
            yearMeta.title.includes('중부대학교 정보보호학과') ? (
              <>
                중부대학교 정보보호학과
                <br />
                {yearMeta.title.replace('중부대학교 정보보호학과', '').trim()}
              </>
            ) : (
              yearMeta.title
            )}
          </h1>
          <div className={styles.metaInfoCards}>
            {yearMeta.headProfessor && (
              <div
                className={styles.metaInfoCard}
                style={{ color: yearMeta.textColor || '#7a2327' }}
              >
                <div className={styles.metaInfoCardLabel}>학과장</div>
                <div className={styles.metaInfoCardValue}>
                  {yearMeta.headProfessor}
                </div>
              </div>
            )}
            {yearMeta.advisors && (
              <div
                className={styles.metaInfoCard}
                style={{ color: yearMeta.textColor || '#7a2327' }}
              >
                <div className={styles.metaInfoCardLabel}>졸업연구 지도교수</div>
                <div className={styles.metaInfoCardValue}>
                  {yearMeta.advisors}
                </div>
              </div>
            )}
            {yearMeta.committee && (
              <div
                className={styles.metaInfoCard}
                style={{ color: yearMeta.textColor || '#7a2327' }}
              >
                <div className={styles.metaInfoCardLabel}>졸업준비위원장</div>
                <div className={styles.metaInfoCardValue}>
                  {yearMeta.committee}
                </div>
              </div>
            )}
            {yearMeta.president && (
              <div
                className={styles.metaInfoCard}
                style={{ color: yearMeta.textColor || '#7a2327' }}
              >
                <div className={styles.metaInfoCardLabel}>학회장</div>
                <div className={styles.metaInfoCardValue}>
                  {yearMeta.president}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.contentWrapper}>
        <div className={styles.leftSpace} />

        <div className={styles.mainContent}>
          <div className={styles.yearSelector}>
            {years.map((year) => (
              <button
                key={year}
                className={`${styles.yearButton} ${
                  selectedYear === year ? styles.active : ''
                }`}
                onClick={() => setSelectedYear(year)}
              >
                {year}년
              </button>
            ))}
          </div>

          {allPhotoLinks.length > 0 && (
            <div className={styles.photoAlbumLinksSection}>
              <h2 className={styles.photoAlbumSectionTitle}>
                {selectedYear}년 포토앨범
              </h2>
              <div className={styles.photoAlbumLinksGrid}>
                <div className={styles.photoAlbumScrollContainer}>
                  <div
                    ref={track1Ref}
                    className={
                        showAnimatedScroll
                        ? styles.photoAlbumScrollTrack
                        : styles.photoAlbumStaticTrack // Apply static style if not enough items
                    }
                  >
                    {renderPhotoAlbumItems(firstHalfLinks, showAnimatedScroll)}
                  </div>
                </div>
                {secondHalfLinks.length > 0 && (
                  <div className={styles.photoAlbumScrollContainer}>
                    <div
                      ref={track2Ref}
                      className={
                        showAnimatedScroll
                          ? `${styles.photoAlbumScrollTrack} ${styles.reverse}`
                          : styles.photoAlbumStaticTrack
                      }
                    >
                      {renderPhotoAlbumItems(secondHalfLinks, showAnimatedScroll)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
           {allPhotoLinks.length === 0 && selectedYear && (
            <div></div>
        )}

          {loading ? (
            <div className={styles.loading}>로딩 중...</div>
          ) : (
            <>
              <div className={styles.postsGrid}>
                {posts.length === 0 ? (
                  <p className={styles.noPostsMessage}>
                    {selectedYear}년에 등록된 게시물이 없습니다.
                  </p>
                ) : (
                  posts.map((post, index) => (
                    <div key={post.id} className={styles.card}>
                      <div className={styles.imageContainer}>
                        <Link href={`/post/${post.id}`} onClick={() => handleView(post.id)}>
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

              {showLoadMoreButton && hasMore && posts.length > 0 && (
                <div className={styles.loadMoreContainer}>
                  <button
                    className={styles.loadMoreSmallButton}
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? '로딩 중...' : '게시물 더보기↓'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.rightBanner}>
          {banners.map((banner) => (
            <img
              key={banner.id}
              src={banner.imageUrl}
              alt={`${selectedYear}년 배너`}
              className={styles.bannerImage}
            />
          ))}
        </div>
      </div>

      {/* Image Enlargement Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <img src={currentModalImage} alt="Enlarged Photo" className={styles.modalImage} />
            <button className={styles.closeButton} onClick={closeModal}>
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}