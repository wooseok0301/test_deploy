'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy,
  deleteDoc,
  where,
} from 'firebase/firestore'
import styles from './page.module.css'

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
  createdAt: {
    toDate: () => Date
  }
}

export default function UserManagement() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const usersPerPage = 7

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
            fetchUsers()
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

  const fetchUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      )
      const querySnapshot = await getDocs(usersQuery)
      const usersData = querySnapshot.docs.map((doc) => ({
        email: doc.id,
        ...doc.data(),
      })) as User[]

      // 역할별로 정렬 (admin -> subAdmin -> user)
      const sortedUsers = usersData.sort((a, b) => {
        const roleOrder = { admin: 0, subAdmin: 1, user: 2 }
        if (roleOrder[a.role] !== roleOrder[b.role]) {
          return roleOrder[a.role] - roleOrder[b.role]
        }
        // 같은 역할 내에서는 가입일 기준 내림차순
        return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
      })

      setUsers(sortedUsers)
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error)
      setError('사용자 목록을 불러오는데 실패했습니다.')
    }
  }

  const handleRoleChange = async (
    email: string,
    newRole: 'subAdmin' | 'user'
  ) => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('권한이 없습니다.')
      return
    }

    if (email === 'rjsgns01@naver.com') {
      alert('최초 관리자의 권한은 변경할 수 없습니다.')
      return
    }

    try {
      const userRef = doc(db, 'users', email)
      await updateDoc(userRef, { role: newRole })
      await fetchUsers()
    } catch (error) {
      console.error('사용자 권한 변경 실패:', error)
      alert('사용자 권한 변경에 실패했습니다.')
    }
  }

  const handleDeleteUser = async (email: string) => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('권한이 없습니다.')
      return
    }

    if (email === 'rjsgns01@naver.com') {
      alert('최초 관리자는 삭제할 수 없습니다.')
      return
    }

    if (email === currentUser.email) {
      alert('자신을 삭제할 수 없습니다.')
      return
    }

    const confirmed = window.confirm(
      `정말로 ${email} 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 해당 사용자의 모든 게시물과 댓글도 함께 삭제됩니다.`
    )

    if (!confirmed) {
      return
    }

    try {
      // 1. 해당 사용자가 작성한 게시물 삭제
      const postsQuery = query(
        collection(db, 'posts'),
        where('author.email', '==', email)
      )
      const postsSnapshot = await getDocs(postsQuery)
      const deletePostPromises = postsSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      )
      await Promise.all(deletePostPromises)

      // 2. 해당 사용자가 작성한 댓글 삭제
      const commentsQuery = query(
        collection(db, 'comments'),
        where('author.email', '==', email)
      )
      const commentsSnapshot = await getDocs(commentsQuery)
      const deleteCommentPromises = commentsSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      )
      await Promise.all(deleteCommentPromises)

      // 3. 해당 사용자가 좋아요한 게시물에서 좋아요 제거 (array-contains로 선별)
      const likedByUserQuery = query(
        collection(db, 'posts'),
        where('likes', 'array-contains', email)
      )
      const likedByUserSnapshot = await getDocs(likedByUserQuery)
      const updateLikesPromises = likedByUserSnapshot.docs.map((doc) => {
        const data = doc.data()
        const updatedLikes = (data.likes || []).filter(
          (like: string) => like !== email
        )
        return updateDoc(doc.ref, { likes: updatedLikes })
      })
      await Promise.all(updateLikesPromises)

      // 4. 사용자 문서 삭제
      const userRef = doc(db, 'users', email)
      await deleteDoc(userRef)

      alert('사용자가 성공적으로 삭제되었습니다.')
      await fetchUsers()
    } catch (error) {
      console.error('사용자 삭제 실패:', error)
      alert('사용자 삭제에 실패했습니다.')
    }
  }

  // 페이지네이션 관련 계산
  const indexOfLastUser = currentPage * usersPerPage
  const indexOfFirstUser = indexOfLastUser - usersPerPage
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser)
  const totalPages = Math.ceil(users.length / usersPerPage)

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  if (error) {
    return <div className={styles.error}>{error}</div>
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>유저 관리</h1>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>가입일</th>
              <th>권한</th>
              <th>관리</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((user) => (
              <tr
                key={user.email}
                className={`${
                  user.role === 'admin'
                    ? styles.adminRow
                    : user.role === 'subAdmin'
                    ? styles.subAdminRow
                    : ''
                }`}
              >
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  {user.createdAt
                    ? new Date(user.createdAt.toDate()).toLocaleDateString()
                    : '-'}
                </td>
                <td>
                  {user.role === 'admin'
                    ? '관리자'
                    : user.role === 'subAdmin'
                    ? '부관리자'
                    : '사용자'}
                </td>
                <td>
                  {currentUser?.role === 'admin' &&
                    user.email !== 'rjsgns01@naver.com' && (
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(
                            user.email,
                            e.target.value as 'subAdmin' | 'user'
                          )
                        }
                        className={styles.select}
                      >
                        <option value="user">사용자</option>
                        <option value="subAdmin">부관리자</option>
                      </select>
                    )}
                </td>
                <td>
                  {currentUser?.role === 'admin' &&
                    user.email !== 'rjsgns01@naver.com' &&
                    user.email !== currentUser.email && (
                      <button
                        onClick={() => handleDeleteUser(user.email)}
                        className={styles.deleteButton}
                        title="사용자 삭제"
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
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
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
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={styles.pageButton}
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
