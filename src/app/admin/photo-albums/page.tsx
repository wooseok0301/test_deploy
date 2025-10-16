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
  arrayUnion, // 배열에 항목 추가
  arrayRemove, // 배열에서 항목 제거
} from 'firebase/firestore'
import styles from './page.module.css' // CSS 모듈 파일을 사용한다고 가정합니다.

interface User {
  email: string
  name: string
  role: 'admin' | 'subAdmin' | 'user'
}

// --- PhotoAlbumEntry 인터페이스 다시 수정: 하나의 항목이 여러 링크(배열)를 가질 수 있도록 ---
interface PhotoAlbumEntry {
  id: string // 각 앨범 항목을 구별할 고유 ID
  links: string[] // 실제 앨범 링크들의 배열
}

// --- PhotoAlbum 인터페이스는 동일하게 유지 ---
interface PhotoAlbum {
  id: string
  year: string
  albums: PhotoAlbumEntry[] // 여러 앨범 항목을 담을 배열
  createdAt: {
    toDate: () => Date
  }
}

export default function PhotoAlbumsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoAlbums, setPhotoAlbums] = useState<PhotoAlbum[]>([])

  // 새 연도 추가를 위한 상태
  const [newYear, setNewYear] = useState('')

  // 특정 연도의 앨범 항목을 관리하기 위한 상태
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null) // 현재 선택된 연도 문서의 ID
  const [selectedYearAlbums, setSelectedYearAlbums] = useState<PhotoAlbumEntry[]>([]) // 선택된 연도의 앨범 항목 리스트

  // 새 앨범 항목 추가를 위한 상태
  // 콤마로 구분된 링크 문자열을 받을 상태
  const [newAlbumEntryLinksString, setNewAlbumEntryLinksString] = useState('')

  // 앨범 항목 수정을 위한 상태
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null) // 수정 중인 앨범 항목의 ID
  // 수정 중인 링크들을 콤마로 구분된 문자열로 받을 상태
  const [editEntryLinksString, setEditEntryLinksString] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const userRef = doc(db, 'users', user.email)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          // 관리자 또는 서브 관리자만 접근 허용
          if (userData.role === 'admin' || userData.role === 'subAdmin') {
            setCurrentUser({
              email: user.email,
              name: userData.name,
              role: userData.role,
            })
            fetchPhotoAlbums() // 권한이 있으면 포토앨범 목록 로드
          } else {
            router.push('/') // 권한 없으면 홈으로 리다이렉트
          }
        } else {
          router.push('/') // 사용자 문서 없으면 홈으로 리다이렉트
        }
      } else {
        router.push('/') // 로그인 안 되어 있으면 홈으로 리다이렉트
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // Firestore에서 모든 연도별 포토앨범 목록을 가져오는 함수
  const fetchPhotoAlbums = async () => {
    try {
      const photoAlbumsRef = collection(db, 'photoAlbums')
      const q = query(photoAlbumsRef, orderBy('year', 'desc')) // 최신 연도가 먼저 오도록 정렬
      const querySnapshot = await getDocs(q)

      const albums = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        albums: doc.data().albums || [], // 'albums' 필드가 없을 경우 빈 배열로 초기화
      })) as PhotoAlbum[]

      setPhotoAlbums(albums)
    } catch (error) {
      console.error('포토앨범 목록 조회 실패:', error)
    }
  }

  // --- 연도 관리 함수들 ---

  // 새 연도 문서를 Firestore에 추가하는 함수
  const handleAddYear = async () => {
    if (!newYear) {
      alert('추가할 연도를 입력해주세요.')
      return
    }

    try {
      // 연도 중복 확인
      const photoAlbumsRef = collection(db, 'photoAlbums')
      const q = query(photoAlbumsRef, where('year', '==', newYear))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        alert('이미 존재하는 연도입니다. 해당 연도를 선택하여 앨범 항목을 추가해주세요.')
        return
      }

      // 새 연도 문서 추가 (albums 필드는 빈 배열로 초기화)
      await addDoc(collection(db, 'photoAlbums'), {
        year: newYear,
        albums: [],
        createdAt: new Date(),
      })

      setNewYear('') // 입력 필드 초기화
      fetchPhotoAlbums() // 목록 새로고침
      alert('연도가 추가되었습니다. 이제 해당 연도를 선택하여 앨범 항목을 등록할 수 있습니다.')
    } catch (error) {
      console.error('연도 추가 실패:', error)
      alert('연도 추가에 실패했습니다.')
    }
  }

  // 특정 연도를 클릭했을 때, 해당 연도의 앨범 항목들을 보여주도록 상태 업데이트
  const handleSelectYear = (album: PhotoAlbum) => {
    setSelectedYearId(album.id)
    setSelectedYearAlbums(album.albums || []) // 'albums' 필드가 없을 경우 빈 배열로 초기화
    setEditingEntryId(null); // 다른 연도 선택 시, 수정 모드 해제
    setNewAlbumEntryLinksString(''); // 새 항목 추가 필드 초기화
  }

  // 선택된 연도 문서를 Firestore에서 삭제하는 함수
  const handleDeleteYear = async (yearId: string) => {
    if (!confirm('정말로 이 연도의 모든 포토앨범 정보를 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteDoc(doc(db, 'photoAlbums', yearId))
      fetchPhotoAlbums() // 목록 새로고침
      if (selectedYearId === yearId) { // 삭제된 연도가 현재 선택된 연도라면, 선택 해제
        setSelectedYearId(null)
        setSelectedYearAlbums([])
      }
      alert('해당 연도의 포토앨범 정보가 삭제되었습니다.')
    } catch (error) {
      console.error('연도 삭제 실패:', error)
      alert('연도 삭제에 실패했습니다.')
    }
  }

  // --- 앨범 항목 관리 함수들 (선택된 연도에 종속) ---

  // 문자열을 배열로 파싱하는 유틸리티 함수
  const parseLinksString = (linksString: string): string[] => {
    // 콤마로 분리하고, 각 항목의 앞뒤 공백을 제거한 후, 비어있는 항목은 필터링
    return linksString.split(',')
                      .map(link => link.trim())
                      .filter(link => link.length > 0);
  }

  // 선택된 연도 문서에 새 앨범 항목을 추가하는 함수
  const handleAddPhotoEntry = async () => {
    if (!selectedYearId) {
      alert('먼저 앨범 항목을 추가할 연도를 선택해주세요.')
      return
    }
    const links = parseLinksString(newAlbumEntryLinksString);

    if (links.length === 0) {
      alert('하나 이상의 유효한 링크를 콤마(,)로 구분하여 입력해주세요.')
      return
    }

    try {
      const photoAlbumRef = doc(db, 'photoAlbums', selectedYearId)
      const newEntryId = Date.now().toString() + Math.random().toString(36).substr(2, 9); // 고유 ID 생성

      const newEntry: PhotoAlbumEntry = {
        id: newEntryId,
        links: links, // 파싱된 링크 배열 저장
      }

      await updateDoc(photoAlbumRef, {
        albums: arrayUnion(newEntry), // Firestore 배열에 새 항목 추가
      })

      setNewAlbumEntryLinksString('') // 입력 필드 초기화
      
      // 로컬 상태를 바로 업데이트하여 UI에 즉시 반영
      setSelectedYearAlbums((prev) => [...prev, newEntry]) 
      fetchPhotoAlbums(); // 전체 목록 새로고침 (선택되지 않은 연도 데이터도 최신으로 유지)
      alert('포토앨범 항목이 추가되었습니다.')
    } catch (error) {
      console.error('포토앨범 항목 추가 실패:', error)
      alert('포토앨범 항목 추가에 실패했습니다.')
    }
  }

  // 앨범 항목 수정을 시작하는 함수
  const startEditEntry = (entry: PhotoAlbumEntry) => {
    setEditingEntryId(entry.id)
    // 배열을 콤마로 구분된 문자열로 변환하여 수정 필드에 설정
    setEditEntryLinksString(entry.links.join(', ')); 
  }

  // 앨범 항목 수정을 취소하는 함수
  const cancelEditEntry = () => {
    setEditingEntryId(null)
    setEditEntryLinksString('')
  }

  // 앨범 항목 수정 내용을 저장하는 함수
  const handleSaveEntryEdit = async (entryId: string) => {
    if (!selectedYearId) {
      alert('연도가 선택되지 않았습니다.')
      return
    }
    const updatedLinks = parseLinksString(editEntryLinksString);

    if (updatedLinks.length === 0) {
      alert('하나 이상의 유효한 링크를 콤마(,)로 구분하여 입력해주세요.')
      return
    }

    try {
      const photoAlbumRef = doc(db, 'photoAlbums', selectedYearId)
      const currentAlbumDoc = await getDoc(photoAlbumRef)

      if (!currentAlbumDoc.exists()) {
        alert('해당 연도 문서를 찾을 수 없습니다.')
        return;
      }

      const currentAlbums = (currentAlbumDoc.data() as PhotoAlbum).albums || []

      // 수정된 앨범 항목으로 배열 업데이트
      const updatedAlbums = currentAlbums.map((entry) =>
        entry.id === entryId
          ? { ...entry, links: updatedLinks } // 파싱된 링크 배열로 업데이트
          : entry
      )

      await updateDoc(photoAlbumRef, {
        albums: updatedAlbums,
      })

      setEditingEntryId(null) // 수정 모드 해제
      setEditEntryLinksString('') // 입력 필드 초기화
      setSelectedYearAlbums(updatedAlbums) // 로컬 상태 업데이트
      fetchPhotoAlbums() // 전체 목록 새로고침
      alert('포토앨범 항목이 수정되었습니다.')
    } catch (error) {
      console.error('포토앨범 항목 수정 실패:', error)
      alert('포토앨범 항목 수정에 실패했습니다.')
    }
  }

  // 앨범 항목을 삭제하는 함수
  const handleDeleteEntry = async (entryId: string) => {
    if (!selectedYearId || !confirm('정말로 이 포토앨범 항목을 삭제하시겠습니까? (이 항목에 포함된 모든 링크가 삭제됩니다.)')) {
      return
    }

    try {
      const photoAlbumRef = doc(db, 'photoAlbums', selectedYearId)
      // 삭제할 항목을 정확히 찾아서 arrayRemove에 넘겨주기 위해 현재 상태에서 찾음
      const entryToDelete = selectedYearAlbums.find((entry) => entry.id === entryId)

      if (entryToDelete) {
        await updateDoc(photoAlbumRef, {
          albums: arrayRemove(entryToDelete), // Firestore 배열에서 항목 제거
        })
        setSelectedYearAlbums((prev) => prev.filter((entry) => entry.id !== entryId)) // 로컬 상태 업데이트
        fetchPhotoAlbums() // 전체 목록 새로고침
        alert('포토앨범 항목이 삭제되었습니다.')
      }
    } catch (error) {
      console.error('포토앨범 항목 삭제 실패:', error)
      alert('포토앨범 항목 삭제에 실패했습니다.')
    }
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
        <h1>포토앨범 관리</h1>
        <button
          onClick={() => router.push('/admin')}
          className={styles.backButton}
        >
          ← 대시보드로 돌아가기
        </button>
      </div>

      {/* 1. 새 연도 추가 섹션 */}
      <div className={styles.addSection}>
        <h2>새 연도 추가</h2>
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="연도 (예: 2024)"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            className={styles.input}
          />
          <button onClick={handleAddYear} className={styles.addButton}>
            + 연도 추가
          </button>
        </div>
      </div>

      {/* 2. 연도별 목록 및 선택 섹션 */}
      <div className={styles.listSection}>
        <h2>연도별 포토앨범 목록</h2>
        {photoAlbums.length === 0 ? (
          <p className={styles.noData}>등록된 연도가 없습니다.</p>
        ) : (
          <div className={styles.yearSelectionGrid}>
            {photoAlbums.map((album) => (
              <div
                key={album.id}
                className={`${styles.yearItem} ${selectedYearId === album.id ? styles.selectedYear : ''}`}
                onClick={() => handleSelectYear(album)}
              >
                <span>{album.year}년</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation() // 연도 선택 이벤트가 같이 발생하는 것을 방지
                    handleDeleteYear(album.id)
                  }}
                  className={styles.deleteButtonSmall}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. 선택된 연도의 앨범 항목 관리 섹션 (연도가 선택되었을 때만 표시) */}
      {selectedYearId && (
        <div className={styles.manageEntriesSection}>
          <h2>
            {photoAlbums.find(a => a.id === selectedYearId)?.year}년 포토앨범 항목 관리
          </h2>

          {/* 새 앨범 항목 추가 폼 */}
          <div className={styles.addEntryForm}>
            <h3>새 앨범 항목 추가</h3>
            <textarea // 여러 줄 입력 가능하도록 textarea 사용
              placeholder="콤마(,)로 구분된 앨범 링크들을 입력하세요 (예: link1, link2, link3)"
              value={newAlbumEntryLinksString}
              onChange={(e) => setNewAlbumEntryLinksString(e.target.value)}
              className={styles.textareaInput} // 새로운 스타일 클래스 적용
              rows={4} // 기본 높이 설정
            />
            <button onClick={handleAddPhotoEntry} className={styles.addButton}>
              + 앨범 항목 추가
            </button>
          </div>

          {/* 앨범 항목 목록 */}
          <div className={styles.photoEntryList}>
            {selectedYearAlbums.length === 0 ? (
              <p className={styles.noData}>이 연도에 등록된 앨범 항목이 없습니다.</p>
            ) : (
              selectedYearAlbums.map((entry) => (
                <div key={entry.id} className={styles.photoEntryItem}>
                  {editingEntryId === entry.id ? (
                    // 수정 모드
                    <div className={styles.editEntryForm}>
                      <textarea
                        value={editEntryLinksString}
                        onChange={(e) => setEditEntryLinksString(e.target.value)}
                        className={styles.textareaInput} // textarea 스타일 적용
                        rows={4}
                      />
                      <div className={styles.editButtons}>
                        <button
                          onClick={() => handleSaveEntryEdit(entry.id)}
                          className={styles.saveButton}
                        >
                          저장
                        </button>
                        <button
                          onClick={cancelEditEntry}
                          className={styles.cancelButton}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 일반 보기 모드
                    <div className={styles.entryInfo}>
                      <div className={styles.entryDetails}>
                        <p className={styles.entryTitle}>
                            앨범 ({entry.id.substring(0, 6)}...)
                        </p>
                        <div className={styles.entryLinksContainer}>
                          {entry.links.map((link, index) => (
                            <a
                              key={index} // 배열 내 각 링크의 고유 키
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.entryLink}
                            >
                              {link}
                            </a>
                          ))}
                        </div>
                      </div>
                      <div className={styles.entryActions}>
                        <button
                          onClick={() => startEditEntry(entry)}
                          className={styles.editButton}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className={styles.deleteButton}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}