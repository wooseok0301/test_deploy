'use client'

import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore'
import { db, auth } from '@/firebase/firebase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import styles from './page.module.css'

interface Post {
  id: string
  title: string
  content: string
  imageUrl?: string
  author: {
    name: string
  }
  likes: string[]
  views: number
  createdAt: {
    toDate: () => Date
  }
  thumbnailUrl?: string
  teamName?: string
  teamMembers?: {
    name: string
    role: string
    githubLink?: string
    portfolioLink?: string
  }[]
  techStack?: string[]
}

export default function HallOfFame() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        // 좋아요가 있는 게시물만 조회하고 서버에서 정렬 (최대 10개)
        const postsRef = collection(db, 'posts')
        const q = query(
          postsRef,
          orderBy('likes', 'desc'),
          limit(10) // 서버에서 좋아요 순으로 상위 10개만 조회
        )
        const querySnapshot = await getDocs(q)

        const fetchedPosts = querySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            likes: doc.data().likes || [],
            views: doc.data().views || 0,
            createdAt: doc.data().createdAt,
          }))
          .filter((post) => post.likes.length > 0) // 좋아요가 있는 게시물만 필터링
          .sort((a, b) => {
            // 1. 좋아요 수로 정렬 (서버에서 이미 정렬됨)
            if (b.likes.length !== a.likes.length) {
              return b.likes.length - a.likes.length
            }
            // 2. 좋아요 수가 같으면 조회수로 정렬
            if (b.views !== a.views) {
              return b.views - a.views
            }
            // 3. 조회수도 같으면 최신순으로 정렬
            return (
              b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
            )
          })

        // 상위 3개 게시물 선택
        const selectedPosts = fetchedPosts.slice(0, 3).map((post) => ({
          ...post,
          likes: post.likes || [],
          views: post.views || 0,
        })) as Post[]

        // 게시물 순서 재배치 (1등: 가운데, 2등: 왼쪽, 3등: 오른쪽)
        const orderedPosts: (Post | undefined)[] = [
          undefined,
          undefined,
          undefined,
        ]

        if (selectedPosts.length > 0) {
          orderedPosts[1] = selectedPosts[0] // 1등 (가운데)
          if (selectedPosts.length > 1) {
            orderedPosts[0] = selectedPosts[1] // 2등 (왼쪽)
          }
          if (selectedPosts.length > 2) {
            orderedPosts[2] = selectedPosts[2] // 3등 (오른쪽)
          }
        }

        // undefined가 아닌 게시물만 필터링하고 순서 유지
        const filteredPosts = orderedPosts.filter(
          (post): post is Post => post !== undefined
        )
        setPosts(filteredPosts)
      } catch (error) {
        console.error('게시물 로딩 중 오류:', error)
        toast.error('게시물을 불러오는 중 오류가 발생했습니다.')
      }
      setLoading(false)
    }

    fetchPosts()
  }, [])

  const handleLike = async (
    postId: string,
    currentLikes: string[],
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast.error('로그인이 필요합니다.')
      router.push('/login')
      return
    }

    try {
      const postRef = doc(db, 'posts', postId)
      const isLiked = currentLikes.includes(user.email)

      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.email),
        })
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.email),
        })
      }

      // 게시물 목록 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter((email) => email !== user.email)
                : [...post.likes, user.email],
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('좋아요 처리 중 오류:', error)
      toast.error('좋아요 처리 중 오류가 발생했습니다.')
    }
  }

  const handleView = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId)
      await updateDoc(postRef, {
        views: increment(1),
      })

      // 게시물 목록 업데이트
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              views: (post.views || 0) + 1,
            }
          }
          return post
        })
      )
    } catch (error) {
      console.error('조회수 증가 중 오류:', error)
    }
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.leftSpace}></div>
      <div className={styles.mainContent}>
        <h1 className={styles.title}>명예의 전당</h1>
        {loading ? (
          <div className={styles.loading}>로딩 중...</div>
        ) : posts.length === 0 ? (
          <div className={styles.noPosts}>
            아직 좋아요를 받은 게시물이 없습니다.
          </div>
        ) : (
          <div className={styles.podium}>
            {posts.map((post, index) => (
              <div
                key={post.id}
                className={`${styles.podiumItem} ${
                  index === 1
                    ? styles.first
                    : index === 0
                    ? styles.second
                    : styles.third
                }`}
              >
                <div className={styles.rankBadge}>
                  <span>
                    {index === 1 ? '🥇 1등' : index === 0 ? '🥈 2등' : '🥉 3등'}
                  </span>
                  <span className={styles.likeCount}>
                    좋아요 {post.likes.length}개
                  </span>
                </div>
                <div className={styles.postCard}>
                  <div className={styles.imageContainer}>
                    <Link href={`/post/${post.id}`}>
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
                            post.likes.includes(user?.email || '')
                              ? styles.liked
                              : ''
                          }`}
                          onClick={(e) => handleLike(post.id, post.likes, e)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={
                              post.likes.includes(user?.email || '')
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
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.rightBanner}>{/* 배너 공간 */}</div>
    </div>
  )
}
