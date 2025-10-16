'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  increment,
  limit,
} from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '@/firebase/firebase'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import styles from './search.module.css'

interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
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

export default function SearchPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const query = searchParams.get('q')
    if (query) {
      setSearchQuery(query)
      performSearch(query)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const performSearch = async (searchTerm: string) => {
    setLoading(true)
    try {
      // 검색 결과 제한 (최대 30개)
      const postsRef = collection(db, 'posts')
      const q = query(
        postsRef,
        orderBy('createdAt', 'desc'),
        limit(30) // 검색 결과를 30개로 제한
      )
      const querySnapshot = await getDocs(q)

      const searchResults = querySnapshot.docs
        .map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            author: {
              name: data.author?.name || '익명',
              email: data.author?.email || 'unknown',
            },
            likes: data.likes || [],
            views: data.views || 0,
          } as Post
        })
        .filter((post) => {
          const searchLower = searchTerm.toLowerCase()
          return (
            post.title.toLowerCase().includes(searchLower) ||
            post.content.toLowerCase().includes(searchLower) ||
            post.teamName?.toLowerCase().includes(searchLower) ||
            post.teamMembers?.some((member) =>
              member.name.toLowerCase().includes(searchLower)
            ) ||
            post.techStack?.some((tech) =>
              tech.toLowerCase().includes(searchLower)
            )
          )
        })

      setPosts(searchResults)
    } catch (error) {
      console.error('검색 중 오류 발생:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

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

      // 게시물 목록 업데이트
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>검색 중...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchHeader}>
        <h1 className={styles.title}>검색 결과</h1>
      </div>

      <div className={styles.resultsInfo}>
        <p>
          {searchQuery}에 대한 검색 결과: {posts.length}개
        </p>
      </div>

      {posts.length === 0 ? (
        <div className={styles.noResults}>
          <h2>검색 결과가 없습니다</h2>
          <p>다른 키워드로 검색해보세요.</p>
          <Link href="/" className={styles.backButton}>
            메인으로 돌아가기
          </Link>
        </div>
      ) : (
        <div className={styles.postsGrid}>
          {posts.map((post) => (
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
                          지도교수: {professors.map((p) => p.name).join(', ')}
                        </span>
                      ) : null
                    })()}
                  {post.techStack && post.techStack.length > 0 && (
                    <div className={styles.techStackContainer}>
                      <div className={styles.techStackList}>
                        {post.techStack.slice(0, 3).map((tech, index) => (
                          <span key={index} className={styles.techStackItem}>
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
                      {formatDate(post.createdAt.toDate())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
