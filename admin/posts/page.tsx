'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  updateDoc,
  increment,
  limit,
  startAfter,
  getCountFromServer,
  DocumentSnapshot,
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase/firebase'
import Link from 'next/link'
import styles from './page.module.css'

interface Post {
  id: string
  title: string
  author: {
    name: string
    email: string
  }
  createdAt: {
    toDate: () => Date
  }
  views: number
  likes: string[]
}

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
}

export default function PostManagement() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  // users 상태 제거 - 게시물에 이미 작성자 정보가 저장되어 있음
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const postsPerPage = 10 // 관리자 페이지에서는 10개씩 표시
  // 각 페이지의 시작 커서 캐시 (1페이지 시작은 null)
  const [pageStarts, setPageStarts] = useState<Array<DocumentSnapshot | null>>([
    null,
  ])
  const [totalPosts, setTotalPosts] = useState(0)

  // fetchUsers 함수 제거 - 게시물에 이미 작성자 정보가 저장되어 있으므로 불필요

  const fetchTotalPosts = async () => {
    const countSnap = await getCountFromServer(query(collection(db, 'posts')))
    setTotalPosts(countSnap.data().count)
  }

  // target 페이지의 시작 커서를 갖고 있도록 필요한 만큼 앞 페이지를 순차적으로 스캔
  const buildCursorUpTo = async (targetPage: number) => {
    // 이미 충분한 커서가 있으면 스킵
    if (pageStarts[targetPage] !== undefined) return

    let workingStarts = [...pageStarts]
    for (let i = workingStarts.length; i <= targetPage; i++) {
      const startCursor = workingStarts[i - 1]
      const qBase = startCursor
        ? query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            startAfter(startCursor),
            limit(postsPerPage)
          )
        : query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(postsPerPage)
          )
      const snap = await getDocs(qBase)
      if (snap.empty) {
        break
      }
      const lastDoc = snap.docs[snap.docs.length - 1]
      workingStarts[i] = lastDoc
    }
    setPageStarts(workingStarts)
  }

  const fetchPosts = async (page: number = 1, reset: boolean = true) => {
    try {
      setLoading(true)

      if (reset) {
        // 리셋 시 커서 캐시 초기화
        setPageStarts([null])
      }

      if (page > 1 && pageStarts[page] === undefined) {
        await buildCursorUpTo(page)
      }

      const startCursor = pageStarts[page - 1] ?? null
      const postsQuery = startCursor
        ? query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            startAfter(startCursor),
            limit(postsPerPage)
          )
        : query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(postsPerPage)
          )

      const querySnapshot = await getDocs(postsQuery)

      // 별도 작성자 조회 제거 - 게시물에 이미 저장된 author 정보 활용
      const postsData = querySnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data()

        // author 정보가 없는 경우 처리
        if (!data.author) {
          return {
            id: docSnapshot.id,
            ...data,
            author: {
              name: '익명',
              email: 'unknown',
            },
            likes: data.likes || [],
            views: data.views || 0,
          } as Post
        }

        // author.email 정보가 없는 경우 처리
        if (!data.author.email) {
          return {
            id: docSnapshot.id,
            ...data,
            author: {
              ...data.author,
              name: data.author.name || '익명',
              email: 'unknown',
            },
            likes: data.likes || [],
            views: data.views || 0,
          } as Post
        }

        // 게시물에 저장된 작성자 정보 그대로 사용 (별도 조회 제거)
        return {
          id: docSnapshot.id,
          ...data,
          author: {
            name: data.author.name || '익명',
            email: data.author.email,
          },
          likes: data.likes || [],
          views: data.views || 0,
        } as Post
      })

      // 다음 페이지 시작 커서 캐시 업데이트
      if (querySnapshot.docs.length > 0) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1]
        setPageStarts((prev) => {
          const next = [...prev]
          next[page] = lastDoc
          return next
        })
      }

      // 번호형 페이지는 해당 페이지 데이터만 표시
      setPosts(postsData)
      setCurrentPage(page)

      setLoading(false)
    } catch (error) {
      console.error('게시물 목록 조회 실패:', error)
      setError('게시물 목록을 불러오는데 실패했습니다.')
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          if (userData.role === 'admin' || userData.role === 'subAdmin') {
            const { email: _, ...userInfo } = userData
            setCurrentUser({ email: user.email, ...userInfo })
            await fetchTotalPosts()
            await fetchPosts(1, true) // 1페이지 로드
          } else {
            router.push('/')
          }
        } else {
          router.push('/')
        }
      } else {
        router.push('/')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // 페이지네이션 핸들러 (번호형)
  const handlePageChange = async (pageNumber: number) => {
    if (pageNumber < 1) return
    const totalPages = Math.max(1, Math.ceil(totalPosts / postsPerPage))
    if (pageNumber > totalPages) return
    await fetchPosts(pageNumber, false)
  }

  const handleDeletePost = async (postId: string) => {
    if (
      !currentUser ||
      (currentUser.role !== 'admin' && currentUser.role !== 'subAdmin')
    ) {
      alert('권한이 없습니다.')
      return
    }

    if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
      return
    }

    try {
      // 먼저 게시물 정보를 가져와서 파일 URL들을 확인
      const postRef = doc(db, 'posts', postId)
      const postSnap = await getDoc(postRef)

      if (postSnap.exists()) {
        const postData = postSnap.data()
        const deleteFilePromises = []

        // 썸네일 이미지 삭제
        if (postData.thumbnailUrl) {
          try {
            const thumbnailRef = ref(storage, postData.thumbnailUrl)
            deleteFilePromises.push(deleteObject(thumbnailRef))
            console.log('썸네일 이미지 삭제:', postData.thumbnailUrl)
          } catch (error) {
            console.error('썸네일 이미지 삭제 실패:', error)
          }
        }

        // 상세 이미지들 삭제
        if (postData.detailImages && postData.detailImages.length > 0) {
          postData.detailImages.forEach((imageUrl: string) => {
            try {
              const detailImageRef = ref(storage, imageUrl)
              deleteFilePromises.push(deleteObject(detailImageRef))
              console.log('상세 이미지 삭제:', imageUrl)
            } catch (error) {
              console.error('상세 이미지 삭제 실패:', error)
            }
          })
        }

        // PPT 파일 삭제
        if (postData.pptFileUrl) {
          try {
            const pptRef = ref(storage, postData.pptFileUrl)
            deleteFilePromises.push(deleteObject(pptRef))
            console.log('PPT 파일 삭제:', postData.pptFileUrl)
          } catch (error) {
            console.error('PPT 파일 삭제 실패:', error)
          }
        }

        // 모든 파일 삭제 실행
        if (deleteFilePromises.length > 0) {
          await Promise.all(deleteFilePromises)
          console.log('모든 파일이 삭제되었습니다.')
        }
      }

      // 게시물 삭제
      await deleteDoc(postRef)
      await fetchPosts()
      alert('게시물과 관련 파일들이 모두 삭제되었습니다.')
    } catch (error) {
      console.error('게시물 삭제 실패:', error)
      alert('게시물 삭제에 실패했습니다.')
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

  if (error) {
    return <div className={styles.error}>{error}</div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>게시물 관리</h1>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>제목</th>
              <th>작성자</th>
              <th>작성일</th>
              <th>조회수</th>
              <th>좋아요</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <Link
                    href={`/post/${post.id}`}
                    className={styles.postLink}
                    onClick={() => handleView(post.id)}
                  >
                    {post.title}
                  </Link>
                </td>
                <td>{post.author.name}</td>
                <td>
                  {post.createdAt
                    ? new Date(post.createdAt.toDate()).toLocaleDateString()
                    : '-'}
                </td>
                <td>{post.views.toLocaleString()}</td>
                <td>{post.likes.length.toLocaleString()}</td>
                <td>
                  {(currentUser?.role === 'admin' ||
                    currentUser?.role === 'subAdmin') && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className={styles.deleteButton}
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <div>
          {Array.from(
            { length: Math.max(1, Math.ceil(totalPosts / postsPerPage)) },
            (_, i) => i + 1
          ).map((number) => (
            <button
              key={number}
              onClick={() => handlePageChange(number)}
              className={`${styles.pageButton} ${
                currentPage === number ? styles.activePage : ''
              }`}
            >
              {number}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
