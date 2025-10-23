'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { User } from 'firebase/auth'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  updateDoc,
  arrayRemove,
  arrayUnion,
  increment,
} from 'firebase/firestore'
import Link from 'next/link'
import styles from './page.module.css'
import { toast } from 'react-hot-toast'

interface Post {
  id: string
  title: string
  content: string
  imageUrl?: string
  author: {
    name: string
    email: string
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

interface Comment {
  id: string
  postId: string
  content: string
  createdAt: {
    toDate: () => Date
  }
  postTitle: string
  postCreatedAt?: {
    toDate: () => Date
  }
  author: {
    name: string
    email: string
  }
  likes: string[]
}

interface UserData {
  name: string
  createdAt: {
    toDate: () => Date
  }
}

export default function MyPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [myComments, setMyComments] = useState<Comment[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<
    'posts' | 'comments' | 'likedPosts'
  >('posts')
  const [loading, setLoading] = useState(true)
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([])
  const [displayedComments, setDisplayedComments] = useState<Comment[]>([])
  const [displayedLikedPosts, setDisplayedLikedPosts] = useState<Post[]>([])
  const [showMorePosts, setShowMorePosts] = useState(false)
  const [showMoreComments, setShowMoreComments] = useState(false)
  const [showMoreLikedPosts, setShowMoreLikedPosts] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      console.log('User authenticated:', user.email)
      setUser(user)
      if (user.email) {
        await fetchUserData(user.email)
        await fetchUserContent(user.email)
      }
    })

    return () => unsubscribe()
  }, [router])

  const fetchUserData = async (email: string) => {
    try {
      const userRef = doc(db, 'users', email)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) {
        setUserData(userSnap.data() as UserData)
      }
    } catch (error) {
      console.error('사용자 정보 로딩 중 오류:', error)
    }
  }

  const fetchUserContent = async (email: string) => {
    try {
      console.log('Fetching content for user:', email)

      // 내가 작성한 게시물 가져오기 (서버 쿼리)
      const postsQuery = query(
        collection(db, 'posts'),
        where('author.email', '==', email),
        orderBy('createdAt', 'desc')
      )
      const postsSnapshot = await getDocs(postsQuery)
      const postsMap = new Map<string, any>()
      const posts = postsSnapshot.docs.map((doc) => {
        const data = doc.data()
        const composed = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          likes: data.likes || [],
          views: data.views || 0,
          author: data.author || { name: '알 수 없음', email },
        } as Post
        postsMap.set(doc.id, { id: doc.id, ...data })
        return composed
      })

      console.log('Filtered posts:', posts.length)
      setMyPosts(posts)
      setDisplayedPosts(posts.slice(0, 9))
      setShowMorePosts(posts.length > 9)

      // 내가 좋아요한 게시물 (서버 쿼리)
      const likedQuery = query(
        collection(db, 'posts'),
        where('likes', 'array-contains', email),
        orderBy('createdAt', 'desc')
      )
      const likedSnapshot = await getDocs(likedQuery)
      const likedPosts = likedSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt,
          likes: data.likes || [],
          views: data.views || 0,
          author: data.author || { name: '알 수 없음', email },
        } as Post
      })

      console.log('Filtered liked posts:', likedPosts.length)
      setLikedPosts(likedPosts)
      setDisplayedLikedPosts(likedPosts.slice(0, 9))
      setShowMoreLikedPosts(likedPosts.length > 9)

      // 내가 작성한 댓글 (서버 쿼리)
      const commentsQuery = query(
        collection(db, 'comments'),
        where('author.email', '==', email),
        orderBy('createdAt', 'desc')
      )
      const commentsSnapshot = await getDocs(commentsQuery)
      const comments = commentsSnapshot.docs
        .map((doc) => {
          const comment = doc.data() as any
          const postData = postsMap.get(comment.postId)
          if (!postData) {
            return null
          }
          return {
            id: doc.id,
            postId: comment.postId,
            content: comment.content,
            createdAt: comment.createdAt,
            author: comment.author || { name: '알 수 없음', email },
            likes: comment.likes || [],
            postTitle: postData.title,
            postCreatedAt: postData.createdAt,
          } as Comment
        })
        .filter((c): c is Comment => c !== null)

      console.log('Filtered comments:', comments.length)
      setMyComments(comments)
      setDisplayedComments(comments.slice(0, 9))
      setShowMoreComments(comments.length > 9)
    } catch (error) {
      console.error('컨텐츠 로딩 중 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (
    postId: string,
    currentLikes: string[],
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user || !user.email) {
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
      setMyPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter((email) => email !== user.email)
                : [...post.likes, user.email!],
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
      setMyPosts((prevPosts) =>
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

      setLikedPosts((prevPosts) =>
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

  const handleShowMorePosts = () => {
    setDisplayedPosts(myPosts)
    setShowMorePosts(false)
  }

  const handleShowMoreComments = () => {
    setDisplayedComments(myComments)
    setShowMoreComments(false)
  }

  const handleShowMoreLikedPosts = () => {
    setDisplayedLikedPosts(likedPosts)
    setShowMoreLikedPosts(false)
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (!user || !userData) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileSection}>
        <div className={styles.profileInfo}>
          <h1 className={styles.userName}>{userData.name}</h1>
          <p className={styles.joinDate}>
            가입일: {userData.createdAt.toDate().toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className={styles.contentSection}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === 'posts' ? styles.active : ''
            }`}
            onClick={() => setActiveTab('posts')}
          >
            내가 작성한 글 ({myPosts.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === 'comments' ? styles.active : ''
            }`}
            onClick={() => setActiveTab('comments')}
          >
            내가 작성한 댓글 ({myComments.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === 'likedPosts' ? styles.active : ''
            }`}
            onClick={() => setActiveTab('likedPosts')}
          >
            좋아요한 게시물 ({likedPosts.length})
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'posts' && (
            <>
              <div className={styles.postsGrid}>
                {displayedPosts.map((post) => (
                  <div key={post.id} className={styles.postCard}>
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
                    <div className={styles.postInfo}>
                      <h2 className={styles.postTitle}>{post.title}</h2>
                      <div className={styles.postMeta}>
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
                              {post.techStack.slice(0, 5).map((tech, index) => (
                                <span
                                  key={index}
                                  className={styles.techStackItem}
                                >
                                  #{tech}
                                </span>
                              ))}
                              {post.techStack.length > 5 && (
                                <span className={styles.techStackMore}>+</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={styles.stats}>
                        <div className={styles.cardStats}>
                          <button
                            className={`${styles.likeButton} ${
                              post.likes.includes(user?.email ?? '')
                                ? styles.liked
                                : ''
                            }`}
                            onClick={(e) => handleLike(post.id, post.likes, e)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill={
                                post.likes.includes(user?.email ?? '')
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
                            조회수: {post.views || 0}
                          </span>
                          <span className={styles.createdAt}>
                            {post.createdAt.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {showMorePosts && (
                <div className={styles.showMoreContainer}>
                  <button
                    className={styles.showMoreButton}
                    onClick={handleShowMorePosts}
                  >
                    게시물 더보기↓
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'comments' && (
            <>
              <div className={styles.commentsList}>
                {displayedComments.map((comment) => (
                  <Link
                    href={`/post/${comment.postId}?commentId=${comment.id}`}
                    key={comment.id}
                    className={styles.commentCard}
                  >
                    <div className={styles.commentInfo}>
                      <div className={styles.commentContent}>
                        <p>{comment.content}</p>
                      </div>
                      <div className={styles.commentMeta}>
                        <div className={styles.postInfo}>
                          <h3 className={styles.postTitle}>
                            {comment.postTitle}
                          </h3>
                          <div className={styles.postMeta}>
                            <span className={styles.author}>
                              작성자: {comment.author.name}
                            </span>
                            <span className={styles.commentDate}>
                              댓글 작성일:{' '}
                              {comment.createdAt.toDate().toLocaleDateString()}
                            </span>
                            <span className={styles.postDate}>
                              게시물 작성일:{' '}
                              {comment.postCreatedAt
                                ?.toDate()
                                .toLocaleDateString() || '날짜 정보 없음'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {showMoreComments && (
                <div className={styles.showMoreContainer}>
                  <button
                    className={styles.showMoreButton}
                    onClick={handleShowMoreComments}
                  >
                    댓글 더보기↓
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'likedPosts' && (
            <>
              <div className={styles.likedPostsGrid}>
                {displayedLikedPosts.map((post) => (
                  <div key={post.id} className={styles.postCard}>
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
                    <div className={styles.postInfo}>
                      <h2 className={styles.postTitle}>{post.title}</h2>
                      <div className={styles.postMeta}>
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
                              {post.techStack.slice(0, 5).map((tech, index) => (
                                <span
                                  key={index}
                                  className={styles.techStackItem}
                                >
                                  #{tech}
                                </span>
                              ))}
                              {post.techStack.length > 5 && (
                                <span className={styles.techStackMore}>+</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={styles.stats}>
                        <div className={styles.cardStats}>
                          <button
                            className={`${styles.likeButton} ${
                              post.likes.includes(user?.email ?? '')
                                ? styles.liked
                                : ''
                            }`}
                            onClick={(e) => handleLike(post.id, post.likes, e)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill={
                                post.likes.includes(user?.email ?? '')
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
                            조회수: {post.views || 0}
                          </span>
                          <span className={styles.createdAt}>
                            {post.createdAt.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {showMoreLikedPosts && (
                <div className={styles.showMoreContainer}>
                  <button
                    className={styles.showMoreButton}
                    onClick={handleShowMoreLikedPosts}
                  >
                    좋아요한 게시물 더보기↓
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
