'use client'

import { useState, useEffect } from 'react'
import { storage } from '@/firebase/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import styles from './PptViewer.module.css'

interface PptViewerProps {
  file?: File | null
  fileUrl?: string
  width?: string
  height?: string
  showControls?: boolean
  onSlideChange?: (slideIndex: number) => void
  readOnly?: boolean
}

export default function PptViewer({
  file,
  fileUrl,
  width = '100%',
  height = '500px',
  showControls = true,
  onSlideChange,
  readOnly = false,
}: PptViewerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const uploadFile = async () => {
      if (file) {
        try {
          setLoading(true)
          // Firebase Storage에 파일 업로드
          const storageRef = ref(
            storage,
            `ppt-preview/${Date.now()}_${file.name}`
          )
          await uploadBytes(storageRef, file)
          const url = await getDownloadURL(storageRef)
          setPreviewUrl(url)
        } catch (err) {
          console.error('파일 업로드 실패:', err)
          setError('파일 업로드 중 오류가 발생했습니다.')
        } finally {
          setLoading(false)
        }
      } else if (fileUrl) {
        setPreviewUrl(fileUrl)
      }
    }

    uploadFile()
  }, [file, fileUrl])

  const handleLoad = () => {
    setLoading(false)
  }

  const handleError = () => {
    setError('파일 로딩 중 오류가 발생했습니다.')
    setLoading(false)
  }

  const getViewerUrl = (url: string) => {
    // Google Docs Viewer URL 생성
    return `https://docs.google.com/viewer?url=${encodeURIComponent(
      url
    )}&embedded=true`
  }

  return (
    <div className={styles.container}>
      {loading && <div className={styles.loading}>로딩 중...</div>}
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.viewerContainer} style={{ width, height }}>
        {previewUrl && (
          <iframe
            src={getViewerUrl(previewUrl)}
            width="100%"
            height="100%"
            frameBorder="0"
            onLoad={handleLoad}
            onError={handleError}
            style={{ border: 'none' }}
            allowFullScreen
          />
        )}
      </div>
    </div>
  )
}
