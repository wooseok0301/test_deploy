'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import styles from './page.module.css'

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
}

interface YearMeta {
  id: string
  year: string
  title: string
  headProfessor: string
  advisors: string
  committee: string
  president: string
  color?: string
  textColor?: string
  createdAt: {
    toDate: () => Date
  }
}

export default function YearMetaPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearMetas, setYearMetas] = useState<YearMeta[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newYear, setNewYear] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newHeadProfessor, setNewHeadProfessor] = useState('')
  const [newAdvisors, setNewAdvisors] = useState('')
  const [newCommittee, setNewCommittee] = useState('')
  const [newPresident, setNewPresident] = useState('')
  const [newColor, setNewColor] = useState('#fde1e4')
  const [newTextColor, setNewTextColor] = useState('#7a2327')
  const [editYear, setEditYear] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editHeadProfessor, setEditHeadProfessor] = useState('')
  const [editAdvisors, setEditAdvisors] = useState('')
  const [editCommittee, setEditCommittee] = useState('')
  const [editPresident, setEditPresident] = useState('')
  const [editColor, setEditColor] = useState('#fde1e4')
  const [editTextColor, setEditTextColor] = useState('#7a2327')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          if (userData.role === 'admin' || userData.role === 'subAdmin') {
            setCurrentUser({
              email: user.email,
              name: userData.name,
              role: userData.role,
            })
            fetchYearMetas()
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

  const fetchYearMetas = async () => {
    try {
      const yearMetasRef = collection(db, 'yearMetas')
      const q = query(yearMetasRef, orderBy('year', 'desc'))
      const querySnapshot = await getDocs(q)
      const metas = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as YearMeta[]
      setYearMetas(metas)
    } catch (error) {
      console.error('연도 메타데이터 목록 조회 실패:', error)
    }
  }

  const handleAddYearMeta = async () => {
    if (!newYear || !newTitle) {
      alert('연도와 제목을 입력해주세요.')
      return
    }
    try {
      // 연도 중복 확인
      const yearMetasRef = collection(db, 'yearMetas')
      const q = query(yearMetasRef, where('year', '==', newYear))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        alert('이미 존재하는 연도입니다.')
        return
      }
      await addDoc(collection(db, 'yearMetas'), {
        year: newYear,
        title: newTitle,
        headProfessor: newHeadProfessor,
        advisors: newAdvisors,
        committee: newCommittee,
        president: newPresident,
        color: newColor,
        textColor: newTextColor,
        createdAt: new Date(),
      })
      setNewYear('')
      setNewTitle('')
      setNewHeadProfessor('')
      setNewAdvisors('')
      setNewCommittee('')
      setNewPresident('')
      setNewColor('#fde1e4')
      setNewTextColor('#7a2327')
      fetchYearMetas()
      alert('연도 메타데이터가 추가되었습니다.')
    } catch (error) {
      console.error('연도 메타데이터 추가 실패:', error)
      alert('연도 메타데이터 추가에 실패했습니다.')
    }
  }

  const handleEditYearMeta = async (id: string) => {
    if (!editYear || !editTitle) {
      alert('연도와 제목을 입력해주세요.')
      return
    }
    try {
      // 연도 중복 확인 (자신 제외)
      const yearMetasRef = collection(db, 'yearMetas')
      const q = query(yearMetasRef, where('year', '==', editYear))
      const querySnapshot = await getDocs(q)
      const existingMeta = querySnapshot.docs.find((doc) => doc.id !== id)
      if (existingMeta) {
        alert('이미 존재하는 연도입니다.')
        return
      }
      const yearMetaRef = doc(db, 'yearMetas', id)
      await updateDoc(yearMetaRef, {
        year: editYear,
        title: editTitle,
        headProfessor: editHeadProfessor,
        advisors: editAdvisors,
        committee: editCommittee,
        president: editPresident,
        color: editColor,
        textColor: editTextColor,
      })
      setEditingId(null)
      setEditYear('')
      setEditTitle('')
      setEditHeadProfessor('')
      setEditAdvisors('')
      setEditCommittee('')
      setEditPresident('')
      setEditColor('#fde1e4')
      setEditTextColor('#7a2327')
      fetchYearMetas()
      alert('연도 메타데이터가 수정되었습니다.')
    } catch (error) {
      console.error('연도 메타데이터 수정 실패:', error)
      alert('연도 메타데이터 수정에 실패했습니다.')
    }
  }

  const handleDeleteYearMeta = async (id: string) => {
    if (!confirm('정말로 이 연도 메타데이터를 삭제하시겠습니까?')) {
      return
    }
    try {
      await deleteDoc(doc(db, 'yearMetas', id))
      fetchYearMetas()
      alert('연도 메타데이터가 삭제되었습니다.')
    } catch (error) {
      console.error('연도 메타데이터 삭제 실패:', error)
      alert('연도 메타데이터 삭제에 실패했습니다.')
    }
  }

  const startEdit = (meta: YearMeta) => {
    setEditingId(meta.id)
    setEditYear(meta.year)
    setEditTitle(meta.title)
    setEditHeadProfessor(meta.headProfessor)
    setEditAdvisors(meta.advisors)
    setEditCommittee(meta.committee)
    setEditPresident(meta.president)
    setEditColor(meta.color || '#fde1e4')
    setEditTextColor(meta.textColor || '#7a2327')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditYear('')
    setEditTitle('')
    setEditHeadProfessor('')
    setEditAdvisors('')
    setEditCommittee('')
    setEditPresident('')
    setEditColor('#fde1e4')
    setEditTextColor('#7a2327')
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }
  if (!currentUser) {
    return null
  }
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>연도별 상단 정보 관리</h1>
        <button
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          ← 대시보드로 돌아가기
        </button>
      </div>
      <div className={styles.addSection}>
        <h2>새 연도 정보 추가</h2>
        <div className={styles.addForm}>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="연도 (예: 2024)"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={`${styles.input} ${styles.titleInput}`}
            />
          </div>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="학과장"
              value={newHeadProfessor}
              onChange={(e) => setNewHeadProfessor(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="지도교수"
              value={newAdvisors}
              onChange={(e) => setNewAdvisors(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="졸업준비위원장"
              value={newCommittee}
              onChange={(e) => setNewCommittee(e.target.value)}
              className={styles.input}
            />
            <input
              type="text"
              placeholder="학회장"
              value={newPresident}
              onChange={(e) => setNewPresident(e.target.value)}
              className={styles.input}
            />
            <span className={styles.colorGroup}>
              <span className={styles.colorLabel}>배경색</span>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className={styles.colorInput}
                title="배경색 선택"
              />
            </span>
            <span className={styles.colorGroup}>
              <span className={styles.colorLabel}>텍스트 색상</span>
              <input
                type="color"
                value={newTextColor}
                onChange={(e) => setNewTextColor(e.target.value)}
                className={styles.colorInput}
                title="텍스트 색상 선택"
              />
            </span>
          </div>
          <button onClick={handleAddYearMeta} className={styles.addButton}>
            +
          </button>
        </div>
      </div>
      <div className={styles.listSection}>
        <h2>연도별 정보 목록</h2>
        {yearMetas.length === 0 ? (
          <p className={styles.noData}>등록된 연도 정보가 없습니다.</p>
        ) : (
          <div className={styles.yearMetaList}>
            {yearMetas.map((meta) => (
              <div key={meta.id} className={styles.yearMetaItem}>
                {editingId === meta.id ? (
                  <div className={styles.editForm}>
                    <div className={styles.formRow}>
                      <input
                        type="text"
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={`${styles.input} ${styles.titleInput}`}
                      />
                    </div>
                    <div className={styles.formRow}>
                      <input
                        type="text"
                        value={editHeadProfessor}
                        onChange={(e) => setEditHeadProfessor(e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editAdvisors}
                        onChange={(e) => setEditAdvisors(e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editCommittee}
                        onChange={(e) => setEditCommittee(e.target.value)}
                        className={styles.input}
                      />
                      <input
                        type="text"
                        value={editPresident}
                        onChange={(e) => setEditPresident(e.target.value)}
                        className={styles.input}
                      />
                      <span className={styles.colorGroup}>
                        <span className={styles.colorLabel}>배경색</span>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className={styles.colorInput}
                          title="배경색 선택"
                        />
                      </span>
                      <span className={styles.colorGroup}>
                        <span className={styles.colorLabel}>텍스트 색상</span>
                        <input
                          type="color"
                          value={editTextColor}
                          onChange={(e) => setEditTextColor(e.target.value)}
                          className={styles.colorInput}
                          title="텍스트 색상 선택"
                        />
                      </span>
                    </div>
                    <div className={styles.editButtons}>
                      <button
                        onClick={() => handleEditYearMeta(meta.id)}
                        className={styles.saveButton}
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEdit}
                        className={styles.cancelButton}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.metaInfoBox}>
                    <div className={styles.metaYear}>
                      <b>{meta.year}</b>
                    </div>
                    <div className={styles.metaTitle}>{meta.title}</div>
                    <div className={styles.metaInfoSmall}>
                      {meta.headProfessor && (
                        <div>학과장: {meta.headProfessor}</div>
                      )}
                      {meta.advisors && <div>지도교수: {meta.advisors}</div>}
                      {meta.committee && (
                        <div>졸업준비위원장: {meta.committee}</div>
                      )}
                      {meta.president && <div>학회장: {meta.president}</div>}
                    </div>
                    <div className={styles.metaActions}>
                      <button
                        onClick={() => startEdit(meta)}
                        className={styles.editButton}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteYearMeta(meta.id)}
                        className={styles.deleteButton}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
