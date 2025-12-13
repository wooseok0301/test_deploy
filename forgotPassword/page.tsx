'use client'

import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/firebase/firebase'
import { useRouter } from 'next/navigation'
import styles from './forgotPassword.module.css'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    try {
      await sendPasswordResetEmail(auth, email)
      setMessage('비밀번호 재설정 이메일이 전송되었습니다.')
      setEmail('')
    } catch (err: any) {
      console.error('비밀번호 재설정 오류:', err)
      if (err.code === 'auth/user-not-found') {
        setError('등록된 이메일이 아닙니다.')
        setEmail('')
      } else {
        setError('이메일 전송에 실패했습니다. 다시 시도해 주세요.')
      }
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>비밀번호 재설정</h1>

        <form onSubmit={handleReset} className={styles.form}>
          <input
            type="email"
            placeholder="가입한 이메일을 입력해 주세요"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />

          <button type="submit" className={styles.button}>
            재설정 메일 보내기
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            className={styles.backButton}
          >
            로그인 페이지로 돌아가기
          </button>

          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <p className={styles.info}>
            메일이 도착하지 않았다면 스팸함을 확인해 주세요.
          </p>
        </form>
      </div>
    </div>
  )
}
