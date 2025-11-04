'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db, storage } from '@/firebase/firebase'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import dynamic from 'next/dynamic'
import styles from './edit.module.css'
// PptViewer는 File 객체만 받는다고 가정합니다.
// import PptViewer from '../../../components/PptViewer' // 직접 임포트 대신 dynamic import 사용

const PptViewerDynamic = dynamic(() => import('@/app/components/PptViewer'), {
  ssr: false,
  loading: () => <div className={styles.loading}>PPT 로딩중...</div>,
})

interface TeamMember {
  name: string
  role: '팀장' | '팀원' | '지도교수'
  githubLink?: string
  portfolioLink?: string
}

interface Post {
  id: string
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
  createdAt: {
    toDate: () => Date
  }
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

export default function EditPage() {
  const { id } = useParams()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
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
  const [pptFile, setPptFile] = useState<File | null>(null)
  const [pptUrl, setPptUrl] = useState<string>('')
  // pptInputMode는 기존 데이터에 따라 초기화됩니다.
  const [pptInputMode, setPptInputMode] = useState<'file' | 'url' | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [existingReferenceFiles, setExistingReferenceFiles] = useState<
    string[]
  >([])
  // referenceInputMode도 기존 데이터에 따라 초기화됩니다.
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
  const [existingDetailImages, setExistingDetailImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false) // 클라이언트 사이드 마운트 여부

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRef = doc(db, 'posts', id as string)
        const postSnap = await getDoc(postRef)

        if (!postSnap.exists()) {
          alert('게시물을 찾을 수 없습니다.')
          router.push('/')
          return
        }

        const postData = postSnap.data() as Post

        // 작성자 확인
        const user = auth.currentUser
        if (!user || postData.author.email !== user.email) {
          alert('수정 권한이 없습니다.')
          router.push('/')
          return
        }

        setPost({ ...postData, id: postSnap.id })
        setTitle(postData.title)
        setContent(postData.content)
        setTeamName(postData.teamName)
        setThumbnailPreview(postData.thumbnailUrl || null)
        setYoutubeLink(
          postData.youtubeVideoId
            ? `${postData.youtubeVideoId}`
            : ''
        )
        setTeamMembers(postData.teamMembers || [])

        // PPT 관련 초기화
        if (postData.pptFileUrl) {
          // 기존 PPT URL이 있다면 URL 모드로 초기화
          setPptInputMode('url')
          setPptUrl(postData.pptFileUrl)
          setPptFile(null); // 기존 URL이 있다면 파일은 null
        } else {
          // 기존 PPT URL이 없다면 파일 업로드 모드로 초기화
          setPptInputMode('file')
          setPptUrl('')
          setPptFile(null); // 파일은 일단 null
        }

        // 참고자료 관련 초기화
        if (postData.referenceFileUrls && postData.referenceFileUrls.length > 0) {
          // 기존 참고 자료 파일이 있다면 파일 업로드 모드로 초기화
          setReferenceInputMode('file')
          setExistingReferenceFiles(postData.referenceFileUrls || [])
          setReferenceUrls(['']) // URL 입력 필드는 초기화
        } else {
          // 기존 참고 자료 파일이 없다면 URL 입력 모드로 초기화
          setReferenceInputMode('url')
          setExistingReferenceFiles([])
          setReferenceUrls(postData.referenceFileUrls && postData.referenceFileUrls.length > 0 ? postData.referenceFileUrls : [''])
        }

        setWebsiteLinks(postData.websiteLinks && postData.websiteLinks.length > 0 ? postData.websiteLinks : [''])
        setGithubLinks(postData.githubLinks && postData.githubLinks.length > 0 ? postData.githubLinks : [''])
        setTechStack(postData.techStack || [])
        setExistingDetailImages(postData.detailImages || [])
      } catch (error) {
        console.error('게시물 불러오기 실패:', error)
        alert('게시물을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id, router])

  useEffect(() => {
    setMounted(true) // 클라이언트 사이드에서 컴포넌트가 마운트되었음을 표시
  }, [])

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

  const addTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      { name: '', role: '팀원', githubLink: '', portfolioLink: '' },
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

  const addTechStack = () => {
    const tech = techStackInput.trim()
    if (tech && !techStack.includes(tech)) {
      setTechStack([...techStack, tech])
      setTechStackInput('')
    }
  }

  const removeTechStack = (index: number) => {
    setTechStack(techStack.filter((_, i) => i !== index))
  }

  const handleTechStackKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTechStack()
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let finalThumbnailUrl = post?.thumbnailUrl || null

      // 썸네일 이미지 업로드
      if (thumbnailFile) {
        const storageRef = ref(
          storage,
          `posts/thumbnails/${Date.now()}_${thumbnailFile.name}`
        )
        await uploadBytes(storageRef, thumbnailFile)
        finalThumbnailUrl = await getDownloadURL(storageRef)
      }

      const postRef = doc(db, 'posts', id as string)

      // 업데이트할 데이터 객체 생성
      const updateData: any = {
        title,
        content,
        thumbnailUrl: finalThumbnailUrl,
        youtubeVideoId: youtubeLink,
        teamName,
        teamMembers: teamMembers.filter((member) => member.name.trim() !== ''),
        techStack,
        websiteLinks: websiteLinks.filter((link) => link.trim() !== ''),
        githubLinks: githubLinks.filter((link) => link.trim() !== ''),
        updatedAt: new Date(),
      }

      // 발표자료 저장 로직
      if (pptInputMode === 'url') {
        updateData.pptFileUrl = pptUrl.trim() !== '' ? pptUrl.trim() : null
      } else if (pptInputMode === 'file') {
        if (pptFile) {
          // 새 파일이 선택되었다면 업로드
          updateData.pptFileUrl = await uploadPpt(pptFile)
        } else if (post?.pptFileUrl && !pptFile && !pptUrl) {
          // 기존 PPT URL이 있었고, 새 파일도 URL도 없으면 기존 URL 유지 (혹은 사용자에게 삭제 확인)
          // 여기서는 기존 URL을 유지하는 방향으로 처리
          updateData.pptFileUrl = post.pptFileUrl;
        } else {
          // 파일도 없고 URL도 없으면 null
          updateData.pptFileUrl = null;
        }
      } else { // pptInputMode가 null인 경우 (초기 로드 시)
        updateData.pptFileUrl = post?.pptFileUrl || null;
      }


      // 참고자료 PDF 파일들 업로드 및 기존/새로운 URL 처리
      let finalReferenceFileUrls: string[] = [];

      if (referenceInputMode === 'file') {
        // 기존에 있던 파일 URL들을 유지 (삭제하지 않은 것들)
        finalReferenceFileUrls = [...existingReferenceFiles];
        // 새로 업로드된 파일들 추가
        for (const file of referenceFiles) {
          const pdfRef = ref(storage, `referenceFiles/${Date.now()}_${file.name}`)
          await uploadBytes(pdfRef, file)
          const url = await getDownloadURL(pdfRef)
          finalReferenceFileUrls.push(url)
        }
      } else if (referenceInputMode === 'url') {
        // URL 모드일 경우, 새로운 URL들만 사용하고 기존 파일 URL은 모두 버림
        finalReferenceFileUrls = referenceUrls.filter((link) => link.trim() !== '');
      } else { // referenceInputMode가 null인 경우 (초기 로드 시)
        finalReferenceFileUrls = post?.referenceFileUrls || [];
      }
      updateData.referenceFileUrls = finalReferenceFileUrls;


      // 상세 이미지 업로드
      const detailImageUrls = [...existingDetailImages]
      for (const file of detailFiles) {
        const imageRef = ref(storage, `detailImages/${Date.now()}_${file.name}`)
        await uploadBytes(imageRef, file)
        const url = await getDownloadURL(imageRef)
        detailImageUrls.push(url)
      }
      updateData.detailImages = detailImageUrls

      await updateDoc(postRef, updateData)

      alert('게시물이 수정되었습니다.')
      router.push(`/post/${id}`)
    } catch (error) {
      console.error('게시물 수정 실패:', error)
      alert('게시물 수정 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const uploadPpt = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `posts/ppt/${Date.now()}_${file.name}`)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
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

      setReferenceFiles((prevFiles) => [...prevFiles, ...pdfFiles])
    }
  }

  const removeReferenceFile = (index: number) => {
    setReferenceFiles(referenceFiles.filter((_, i) => i !== index))
  }

  const addReferenceUrl = () => setReferenceUrls([...referenceUrls, ''])
  const removeReferenceUrl = (index: number) =>
    setReferenceUrls(referenceUrls.filter((_, i) => i !== index))
  const updateReferenceUrl = (index: number, value: string) => {
    const next = [...referenceUrls]
    next[index] = value
    setReferenceUrls(next)
  }

  const addWebsiteLink = () => {
    setWebsiteLinks([...websiteLinks, ''])
  }

  const removeExistingReferenceFile = (index: number) => {
    // 기존 파일 제거 시 실제로 스토리지에서 삭제하는 로직은 updateDoc 이전에 추가해야 하지만,
    // 지금은 UI에서만 제거되도록 처리합니다.
    setExistingReferenceFiles(
      existingReferenceFiles.filter((_, i) => i !== index)
    )
  }

  const updateWebsiteLink = (index: number, value: string) => {
    const newWebsiteLinks = [...websiteLinks]
    newWebsiteLinks[index] = value
    setWebsiteLinks(newWebsiteLinks)
  }

  const removeWebsiteLink = (index: number) => {
    setWebsiteLinks(websiteLinks.filter((_, i) => i !== index))
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

  const handleDetailFilesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || [])
    const newDetailFiles: File[] = []
    const newDetailImagePreviews: string[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} 파일은 5MB를 초과할 수 없습니다.`)
        continue
      }

      newDetailFiles.push(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        newDetailImagePreviews.push(reader.result as string)
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

  const removeExistingDetailImage = (index: number) => {
    setExistingDetailImages(existingDetailImages.filter((_, i) => i !== index))
  }

  if (loading) {
    return <div className={styles.loading}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>게시물 수정</h1>
        <form onSubmit={handleUpdate}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>프로젝트명</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              placeholder="프로젝트명을 입력하세요"
              required
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
              {existingDetailImages.map((imageUrl, index) => (
                <div
                  key={`existing-${index}`}
                  className={styles.detailImageWrapper}
                >
                  <img
                    src={imageUrl}
                    alt={`기존 상세 이미지 ${index + 1}`}
                    className={styles.detailImagePreview}
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingDetailImage(index)}
                    className={styles.removeImageButton}
                  >
                    X
                  </button>
                </div>
              ))}
              {detailImagePreviews.map((preview, index) => (
                <div key={`new-${index}`} className={styles.detailImageWrapper}>
                  <img
                    src={preview}
                    alt={`새 상세 이미지 ${index + 1}`}
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
            <label className={styles.label}>유튜브 링크</label>
            <input
              type="text"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              className={styles.input}
              placeholder="유튜브 영상 링크를 입력하세요"
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
                  value={member.githubLink || ''}
                  onChange={(e) =>
                    updateTeamMember(index, 'githubLink', e.target.value)
                  }
                  className={styles.teamMemberLink}
                  placeholder="GitHub 링크"
                />
                <input
                  type="text"
                  value={member.portfolioLink || ''}
                  onChange={(e) =>
                    updateTeamMember(index, 'portfolioLink', e.target.value)
                  }
                  className={styles.teamMemberLink}
                  placeholder="포트폴리오 링크"
                />
                {index > 0 && (
                  <button
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
              <div className={styles.toggleGroup}>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    pptInputMode === 'file' ? styles.active : ''
                  }`}
                  onClick={() => {
                    setPptInputMode('file')
                    setPptUrl('') // 파일 모드로 전환 시 URL 초기화
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
                    setPptFile(null) // URL 모드로 전환 시 파일 초기화
                  }}
                >
                  URL 입력
                </button>
              </div>

              {pptInputMode === 'url' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>발표자료 URL</label>
                  <input
                    type="text"
                    value={pptUrl}
                    onChange={(e) => setPptUrl(e.target.value)}
                    className={styles.input}
                    placeholder="발표자료 링크를 입력하세요 (예: Google Slides 공유 링크)"
                  />
                  {pptUrl && ( // URL 미리보기 또는 링크 표시
                    <div className={styles.pptUrlPreview}>
                      <a href={pptUrl} target="_blank" rel="noopener noreferrer">
                        발표자료 링크 열기
                      </a>
                    </div>
                  )}
                </div>
              )}

              {pptInputMode === 'file' && (
                <>
                  <input
                    type="file"
                    id="pptFile"
                    accept=".ppt,.pptx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          alert('파일 크기는 10MB를 초과할 수 없습니다.')
                          return
                        }
                        setPptFile(file)
                      }
                    }}
                    className={styles.fileInput}
                  />
                  {pptFile && ( // 새로 선택된 파일의 정보와 삭제 버튼
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
                  {/* 기존 PPT URL이 있고, 현재 파일 업로드 모드이지만 새 파일이 선택되지 않았을 때 */}
                  {post?.pptFileUrl && !pptFile && pptInputMode === 'file' && (
                    <div className={styles.fileInfo}>
                      <span>기존 파일: {post.pptFileUrl.split('/').pop()?.split('_').slice(1).join('_')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmDelete = window.confirm("기존 발표자료를 삭제하시겠습니까? 삭제하시면 새로 업로드하거나 URL을 입력해야 합니다.");
                          if (confirmDelete) {
                            // 실제 스토리지에서 삭제하는 로직은 updateDoc에서 처리합니다.
                            // 여기서는 UI 상태만 업데이트하여 post.pptFileUrl을 빈 값으로 만듭니다.
                            setPost(prev => prev ? {...prev, pptFileUrl: undefined} : null);
                          }
                        }}
                        className={styles.removeFileButton}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* PPT 파일 미리보기는 File 객체가 있을 때만 */}
            {mounted && pptInputMode === 'file' && pptFile && (
              <div className={styles.pptPreview}>
                <PptViewerDynamic file={pptFile} height="500px" />
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
                  onClick={() => {
                    setReferenceInputMode('file')
                    setReferenceUrls(['']) // 파일 모드 전환 시 URL 초기화
                  }}
                >
                  파일 업로드
                </button>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${
                    referenceInputMode === 'url' ? styles.active : ''
                  }`}
                  onClick={() => {
                    setReferenceInputMode('url')
                    setReferenceFiles([]) // URL 모드 전환 시 파일 초기화
                    setExistingReferenceFiles([]) // URL 모드 전환 시 기존 파일 목록도 초기화
                  }}
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
                  {/* 기존 파일 및 새로 추가된 파일 목록 표시 */}
                  {(existingReferenceFiles.length > 0 || referenceFiles.length > 0) && (
                    <div className={styles.referenceFiles}>
                      {existingReferenceFiles.map((fileUrl, index) => {
                        // 변경된 부분: 파일 이름을 "1번 파일", "2번 파일" 형식으로 표시
                        const fileName = `기존 보고서_${index + 1}.pdf`;
                        return (
                          <div key={`existing-${index}`} className={styles.referenceFile}>
                            <span>{fileName}</span>
                            <button
                              type="button"
                              onClick={() => removeExistingReferenceFile(index)}
                              className={styles.removeFileButton}
                            >
                              삭제
                            </button>
                          </div>
                        )
                      })}
                      {referenceFiles.map((file, index) => (
                        <div key={`new-${index}`} className={styles.referenceFile}>
                          <span>새 파일: {file.name}</span>
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
                        placeholder="보고서 링크 입력"
                      />
                      {index > 0 && (
                        <button
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
                    링크 추가
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
                      onClick={() => removeWebsiteLink(index)}
                      className={styles.removeTeamMember}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addWebsiteLink}
                className={styles.addTeamMember}
              >
                웹사이트 링크 추가
              </button>
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
                      onClick={() => removeGithubLink(index)}
                      className={styles.removeTeamMember}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addGithubLink}
                className={styles.addTeamMember}
              >
                GitHub 링크 추가
              </button>
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
                placeholder="기술 스택 입력 후 Enter"
              />
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={uploading}
            >
              {uploading ? '수정 중...' : '수정하기'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/post/${id}`)}
              className={styles.cancelButton}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}