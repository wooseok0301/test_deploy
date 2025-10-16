'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db, storage } from '@/firebase/firebase'
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import styles from './upload.module.css'
import PptViewer from '@/app/components/PptViewer'

interface TeamMember {
  name: string
  role: '팀장' | '팀원' | '지도교수'
  githubLink?: string
  portfolioLink?: string
}

interface Post {
  title: string
  content: string
  thumbnailUrl?: string
  detailImages?: string[]
  youtubeVideoId?: string
  teamName: string
  teamMembers: TeamMember[]
  author: {
    email: string
    name: string
  }
  createdAt: any
  likes: string[]
  views: number
  pptFileUrl?: string
  referenceFileUrls?: string[]
  websiteLinks?: string[]
  githubLinks?: string[]
  techStack?: string[]
}

// 이미지 리사이징 함수
const resizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 메인 페이지 카드 비율에 맞춤 (400px 높이)
        const targetHeight = 400
        const targetWidth = (img.width * targetHeight) / img.height

        canvas.width = targetWidth
        canvas.height = targetHeight

        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('이미지 변환 실패'))
              }
            },
            'image/jpeg',
            0.9
          )
        } else {
          reject(new Error('Canvas context 생성 실패'))
        }
      }
      img.onerror = () => reject(new Error('이미지 로드 실패'))
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
  })
}

// 파일 업로드 함수
const uploadFile = async (file: File, folderName: string): Promise<string> => {
  const storageRef = ref(storage, `${folderName}/${file.name}`)
  const snapshot = await uploadBytes(storageRef, file)
  return await getDownloadURL(snapshot.ref)
}

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [youtubeLink, setYoutubeLink] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: '', role: '팀장', githubLink: '', portfolioLink: '' },
  ])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [pptFile, setPptFile] = useState<File | null>(null)
  const [pptUrl, setPptUrl] = useState<string>('')
  const [pptInputMode, setPptInputMode] = useState<'file' | 'url' | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [referenceInputMode, setReferenceInputMode] = useState<
    'file' | 'url' | null
  >(null)
  const [referenceUrls, setReferenceUrls] = useState<string[]>([''])
  const [websiteLinks, setWebsiteLinks] = useState<string[]>([''])
  const [githubLinks, setGithubLinks] = useState<string[]>([''])
  const [techStack, setTechStack] = useState<string[]>([])
  const [techStackInput, setTechStackInput] = useState('')
  const [detailFiles, setDetailFiles] = useState<File[]>([])
  const [detailImagePreviews, setDetailImagePreviews] = useState<string[]>([])

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleThumbnailChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      try {
        const resizedBlob = await resizeImage(file)
        const resizedFile = new File([resizedBlob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })

        setThumbnailFile(resizedFile)
        const reader = new FileReader()
        reader.onloadend = () => {
          setThumbnailPreview(reader.result as string)
        }
        reader.readAsDataURL(resizedFile)
      } catch (error) {
        console.error('썸네일 이미지 리사이징 실패:', error)
        alert('이미지 처리 중 오류가 발생했습니다.')
      }
    }
  }

  const handleDetailFilesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || [])
    const newDetailFiles: File[] = []
    const newDetailImagePreviews: string[] = []

    for (const file of files) {
      // 이미지 파일만 허용
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        continue
      }
      // 파일 크기 체크 (각 파일 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} 파일은 5MB를 초과할 수 없습니다.`)
        continue
      }

      newDetailFiles.push(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        newDetailImagePreviews.push(reader.result as string)
        // 모든 파일 처리가 끝났을 때만 상태 업데이트
        if (newDetailImagePreviews.length === newDetailFiles.length) {
          setDetailFiles((prev) => [...prev, ...newDetailFiles])
          setDetailImagePreviews((prev) => [...prev, ...newDetailImagePreviews])
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const removeDetailImage = (index: number) => {
    setDetailFiles(detailFiles.filter((_, i) => i !== index))
    setDetailImagePreviews(detailImagePreviews.filter((_, i) => i !== index))
  }

  const handleReferenceFilesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      // PDF 파일만 허용
      const pdfFiles = files.filter((file) => file.type === 'application/pdf')
      if (pdfFiles.length !== files.length) {
        alert('PDF 파일만 업로드 가능합니다.')
        return
      }

      // 파일 크기 체크 (각 파일 10MB)
      if (pdfFiles.some((file) => file.size > 10 * 1024 * 1024)) {
        alert('각 파일의 크기는 10MB를 초과할 수 없습니다.')
        return
      }

      setReferenceFiles([...referenceFiles, ...pdfFiles])
    }
  }

  const removeReferenceFile = (index: number) => {
    setReferenceFiles(referenceFiles.filter((_, i) => i !== index))
  }

  const addReferenceUrl = () => {
    setReferenceUrls([...referenceUrls, ''])
  }

  const removeReferenceUrl = (index: number) => {
    setReferenceUrls(referenceUrls.filter((_, i) => i !== index))
  }

  const updateReferenceUrl = (index: number, value: string) => {
    const next = [...referenceUrls]
    next[index] = value
    setReferenceUrls(next)
  }

  const addWebsiteLink = () => {
    setWebsiteLinks([...websiteLinks, ''])
  }

  const removeWebsiteLink = (index: number) => {
    setWebsiteLinks(websiteLinks.filter((_, i) => i !== index))
  }

  const updateWebsiteLink = (index: number, value: string) => {
    const newWebsiteLinks = [...websiteLinks]
    newWebsiteLinks[index] = value
    setWebsiteLinks(newWebsiteLinks)
  }

  const addTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      { name: '', role: '팀장', githubLink: '', portfolioLink: '' },
    ])
  }

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index))
  }

  const updateTeamMember = (
    index: number,
    field: keyof TeamMember,
    value: string
  ) => {
    const newTeamMembers = teamMembers.map((member, i) => {
      if (i === index) {
        return { ...member, [field]: value }
      }
      return member
    })
    setTeamMembers(newTeamMembers)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('프로젝트명을 입력해주세요.')
      return
    }
    if (!teamName.trim()) {
      alert('팀명을 입력해주세요.')
      return
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.')
      return
    }

    if (teamMembers.length === 0 || !teamMembers[0].name.trim()) {
      alert('최소 한 명의 팀원을 입력해주세요.')
      return
    }

    // 썸네일 파일이 선택되지 않았을 때 추가 검증
    if (!thumbnailFile) {
      alert('썸네일 이미지를 업로드해주세요.')
      return
    }

    setUploading(true)

    try {
      const user = auth.currentUser
      if (!user?.email) {
        alert('로그인이 필요합니다.')
        return
      }

      const userRef = doc(db, 'users', user.email)
      const userSnap = await getDoc(userRef)
      if (!userSnap.exists()) {
        alert('사용자 정보를 찾을 수 없습니다.')
        return
      }
      const userData = userSnap.data()

      let finalThumbnailUrl = ''
      let pptFileUrl = ''
      const referenceFileUrls: string[] = []

      // 썸네일 이미지 업로드
      if (thumbnailFile) {
        const storageRef = ref(
          storage,
          `posts/thumbnails/${Date.now()}_${thumbnailFile.name}`
        )
        await uploadBytes(storageRef, thumbnailFile)
        finalThumbnailUrl = await getDownloadURL(storageRef)
      }

      // 발표자료 입력 모드에 따라 저장
      if (pptInputMode === 'url') {
        if (pptUrl && pptUrl.trim() !== '') {
          pptFileUrl = pptUrl.trim()
        }
      } else if (pptInputMode === 'file') {
        if (pptFile) {
          const pptRef = ref(storage, `pptFiles/${Date.now()}_${pptFile.name}`)
          await uploadBytes(pptRef, pptFile)
          pptFileUrl = await getDownloadURL(pptRef)
        }
      }

      // 참고자료 저장: URL 모드면 URL 추가, 파일 모드면 업로드
      if (referenceInputMode === 'url') {
        referenceUrls
          .map((u) => u.trim())
          .filter((u) => u)
          .forEach((u) => referenceFileUrls.push(u))
      } else {
        for (const file of referenceFiles) {
          const pdfRef = ref(
            storage,
            `referenceFiles/${Date.now()}_${file.name}`
          )
          await uploadBytes(pdfRef, file)
          const url = await getDownloadURL(pdfRef)
          referenceFileUrls.push(url)
        }
      }

      // 상세 이미지 업로드
      const detailImageUrls: string[] = []
      for (const file of detailFiles) {
        const url = await uploadFile(file, 'detail_images')
        detailImageUrls.push(url)
      }

      // 유튜브 링크에서 비디오 ID 추출
      let youtubeVideoId = null
      if (youtubeLink) {
        const regExp =
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
        const match = youtubeLink.match(regExp)
        youtubeVideoId = match && match[2].length === 11 ? match[2] : null
      }

      // 게시물 저장
      await addDoc(collection(db, 'posts'), {
        title,
        content,
        thumbnailUrl: finalThumbnailUrl,
        pptFileUrl,
        referenceFileUrls,
        websiteLinks: websiteLinks.filter((link) => link.trim() !== ''),
        githubLinks: githubLinks.filter((link) => link.trim() !== ''),
        youtubeVideoId,
        teamName,
        teamMembers: teamMembers.filter((member) => member.name.trim() !== ''),
        techStack: techStack.filter((tag) => tag.trim() !== ''),
        author: {
          email: user.email,
          name: userData.name,
        },
        createdAt: serverTimestamp(),
        likes: [],
        views: 0,
        detailImages: detailImageUrls,
      })

      alert('게시물이 등록되었습니다!')
      router.push('/')
    } catch (error) {
      console.error('업로드 에러:', error)
      alert('게시물 등록 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 기술 스택 추가 함수
  const addTechStack = () => {
    const tech = techStackInput.trim()
    if (tech && !techStack.includes(tech)) {
      setTechStack([...techStack, tech])
      setTechStackInput('')
    }
  }

  // 기술 스택 제거 함수
  const removeTechStack = (index: number) => {
    setTechStack(techStack.filter((_, i) => i !== index))
  }

  // Enter 키로 태그 추가
  const handleTechStackKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTechStack()
    }
  }

  // GitHub 링크 추가 함수
  const addGithubLink = () => {
    setGithubLinks([...githubLinks, ''])
  }

  // GitHub 링크 제거 함수
  const removeGithubLink = (index: number) => {
    setGithubLinks(githubLinks.filter((_, i) => i !== index))
  }

  // GitHub 링크 업데이트 함수
  const updateGithubLink = (index: number, value: string) => {
    const newGithubLinks = [...githubLinks]
    newGithubLinks[index] = value
    setGithubLinks(newGithubLinks)
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>새 게시물 작성</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>프로젝트명</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              placeholder="프로젝트명을 입력하세요"
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>팀명</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className={styles.input}
              placeholder="팀명을 입력하세요"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="content" className={styles.label}>
              프로젝트 개요
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={styles.textarea}
              placeholder="프로젝트 내용을 입력하세요"
              rows={10}
            />
          </div>

          {/* 상세 이미지 업로드 */}
          <div className={styles.formGroup}>
            <label htmlFor="detailImages" className={styles.label}>
              상세 이미지
            </label>
            <input
              type="file"
              id="detailImages"
              accept="image/*"
              multiple
              onChange={handleDetailFilesChange}
              className={styles.fileInput}
            />
            <div className={styles.detailImagePreviewContainer}>
              {detailImagePreviews.map((preview, index) => (
                <div key={index} className={styles.detailImageWrapper}>
                  <img
                    src={preview}
                    alt={`상세 이미지 ${index + 1} 미리보기`}
                    className={styles.detailImagePreview}
                  />
                  <button
                    type="button"
                    onClick={() => removeDetailImage(index)}
                    className={styles.removeImageButton}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>썸네일</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              ref={fileInputRef}
              className={styles.fileInput}
            />
            {thumbnailPreview && (
              <div className={styles.imagePreview}>
                <img src={thumbnailPreview} alt="썸네일 미리보기" />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null)
                    setThumbnailPreview(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className={styles.removeImage}
                >
                  썸네일 제거
                </button>
              </div>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>참고영상</label>
            <input
              type="text"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              className={styles.input}
              placeholder="참고영상 링크를 입력하세요"
            />
            {youtubeLink && (
              <div className={styles.youtubePreview}>
                <iframe
                  width="560"
                  height="315"
                  src={`https://www.youtube.com/embed/${
                    youtubeLink.match(
                      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*).*/
                    )?.[1]
                  }`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>멤버</label>
            {teamMembers.map((member, index) => (
              <div key={index} className={styles.teamMemberInput}>
                <select
                  value={member.role}
                  onChange={(e) =>
                    updateTeamMember(
                      index,
                      'role',
                      e.target.value as '팀장' | '팀원' | '지도교수'
                    )
                  }
                  className={styles.roleSelect}
                >
                  <option value="팀장">팀장</option>
                  <option value="팀원">팀원</option>
                  <option value="지도교수">지도교수</option>
                </select>
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) =>
                    updateTeamMember(index, 'name', e.target.value)
                  }
                  className={styles.teamMemberName}
                  placeholder="이름"
                />
                <input
                  type="text"
                  value={member.githubLink}
                  onChange={(e) =>
                    updateTeamMember(index, 'githubLink', e.target.value)
                  }
                  className={styles.teamMemberLink}
                  placeholder="GitHub 링크"
                />
                <input
                  type="text"
                  value={member.portfolioLink}
                  onChange={(e) =>
                    updateTeamMember(index, 'portfolioLink', e.target.value)
                  }
                  className={styles.teamMemberLink}
                  placeholder="포트폴리오 링크"
                />
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removeTeamMember(index)}
                    className={styles.removeTeamMember}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addTeamMember}
              className={styles.addTeamMember}
            >
              멤버추가
            </button>
          </div>
          <div className={styles.formGroup}>
            <h2 className={styles.sectionTitle} style={{ color: '#000' }}>
              발표자료
            </h2>
            <div className={styles.pptUploadSection}>
              {/* 입력 방식 선택 버튼 */}
              <div className={styles.toggleGroup}>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    pptInputMode === 'file' ? styles.active : ''
                  }`}
                  onClick={() => {
                    setPptInputMode('file')
                    setPptUrl('')
                  }}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    pptInputMode === 'url' ? styles.active : ''
                  }`}
                  onClick={() => {
                    setPptInputMode('url')
                    setPptFile(null)
                  }}
                >
                  URL 입력
                </button>
              </div>

              {/* URL 모드 */}
              {pptInputMode === 'url' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>발표자료 URL</label>
                  <input
                    type="text"
                    value={pptUrl}
                    onChange={(e) => setPptUrl(e.target.value)}
                    className={styles.input}
                    placeholder="발표자료 링크를 입력하세요"
                  />
                </div>
              )}

              {/* 파일 모드 */}
              {pptInputMode === 'file' && (
                <input
                  type="file"
                  id="pptFile"
                  accept=".ppt,.pptx"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // 파일 크기 체크 (10MB)
                      if (file.size > 10 * 1024 * 1024) {
                        alert('파일 크기는 10MB를 초과할 수 없습니다.')
                        return
                      }
                      setPptFile(file)
                    }
                  }}
                  className={styles.fileInput}
                />
              )}
              {pptFile && (
                <div className={styles.fileInfo}>
                  <span>{pptFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPptFile(null)}
                    className={styles.removeFileButton}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            {pptInputMode === 'file' && pptFile && (
              <div className={styles.pptPreview}>
                <PptViewer file={pptFile} height="500px" />
              </div>
            )}
          </div>
          <div className={styles.formGroup}>
            <h2 className={styles.sectionTitle} style={{ color: '#000' }}>
              보고서
            </h2>
            <div className={styles.referenceUploadSection}>
              <div className={styles.toggleGroup}>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    referenceInputMode === 'file' ? styles.active : ''
                  }`}
                  onClick={() => setReferenceInputMode('file')}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    referenceInputMode === 'url' ? styles.active : ''
                  }`}
                  onClick={() => setReferenceInputMode('url')}
                >
                  URL 입력
                </button>
              </div>

              {referenceInputMode === 'file' && (
                <>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleReferenceFilesChange}
                    className={styles.fileInput}
                  />
                  {referenceFiles.length > 0 && (
                    <div className={styles.referenceFiles}>
                      {referenceFiles.map((file, index) => (
                        <div key={index} className={styles.referenceFile}>
                          <span>{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeReferenceFile(index)}
                            className={styles.removeFileButton}
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {referenceInputMode === 'url' && (
                <div className={styles.websiteLinksSection}>
                  {referenceUrls.map((link, index) => (
                    <div key={index} className={styles.websiteLinkInput}>
                      <input
                        type="text"
                        value={link}
                        onChange={(e) =>
                          updateReferenceUrl(index, e.target.value)
                        }
                        className={styles.input}
                        placeholder="보고서 URL 입력"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeReferenceUrl(index)}
                          className={styles.removeTeamMember}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addReferenceUrl}
                    className={styles.addTeamMember}
                  >
                    URL 추가
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <h2 className={styles.sectionTitle} style={{ color: '#000' }}>
              웹사이트 링크
            </h2>
            <div className={styles.websiteLinksSection}>
              {websiteLinks.map((link, index) => (
                <div key={index} className={styles.websiteLinkInput}>
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => updateWebsiteLink(index, e.target.value)}
                    className={styles.input}
                    placeholder="웹사이트 링크 입력"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeWebsiteLink(index)}
                      className={styles.removeTeamMember}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.formGroup}>
            <h2 className={styles.sectionTitle} style={{ color: '#000' }}>
              GitHub 링크
            </h2>
            <div className={styles.websiteLinksSection}>
              {githubLinks.map((link, index) => (
                <div key={index} className={styles.websiteLinkInput}>
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => updateGithubLink(index, e.target.value)}
                    className={styles.input}
                    placeholder="GitHub 링크 입력"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeGithubLink(index)}
                      className={styles.removeTeamMember}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.formGroup}>
            <h2 className={styles.sectionTitle} style={{ color: '#000' }}>
              기술 스택
            </h2>
            <div className={styles.techStackSection}>
              {techStack.map((tech, index) => (
                <div key={index} className={styles.techStackItem}>
                  <span># {tech}</span>
                  <button
                    type="button"
                    onClick={() => removeTechStack(index)}
                    className={styles.removeTechStackButton}
                  >
                    ×
                  </button>
                </div>
              ))}
              <input
                type="text"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                onKeyDown={handleTechStackKeyPress}
                className={styles.techStackInput}
                placeholder="기술 스택 입력"
              />
            </div>
          </div>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={uploading}
          >
            {uploading ? '업로드 중...' : '게시하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
