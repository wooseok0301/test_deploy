'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from './page.module.css'; // CSS 모듈을 import 합니다.
import { auth, db } from '@/firebase/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';

export default function EditName() {
  const router = useRouter();
  const [currentName, setCurrentName] = useState('');
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        const userRef = doc(db, 'users', user.email as string);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentName(userData.name);
          setNewName(userData.name); // 현재 이름을 새 이름 필드에 미리 채워넣기
        } else {
          alert('사용자 정보를 찾을 수 없습니다. 다시 로그인 해주세요.');
          router.push('/login');
        }
      } else {
        alert('로그인이 필요합니다.');
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleNewNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewName(value);
    setNameError(value.trim() === '' ? '새 이름을 입력해주세요.' : '');
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) {
      setNameError('새 이름을 입력해주세요.');
      return;
    }

    if (newName === currentName) {
      alert('현재 이름과 동일합니다. 다른 이름을 입력해주세요.');
      return;
    }

    if (!userEmail) {
      alert('사용자 정보가 없습니다. 다시 로그인 해주세요.');
      router.push('/login');
      return;
    }

    try {
      const userRef = doc(db, 'users', userEmail);
      await updateDoc(userRef, {
        name: newName,
      });

      alert('이름이 성공적으로 변경되었습니다!');
      setCurrentName(newName); // 현재 이름 업데이트
      router.push('/mypage'); // 이름 변경 후 이동할 페이지 (예: 프로필 페이지)
    } catch (error) {
      console.error('이름 변경 실패:', error);
      alert('이름 변경 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className={styles.pageWrapper}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <Head>
        <title>이름 변경</title>
      </Head>

      <div className={styles.container}>
        <h1 className={styles.title}>이름 변경</h1>

        <form className={styles.form} onSubmit={handleUpdateName}>
          <div className={styles.infoText}>
            <p>
              현재 이름: <strong>{currentName}</strong>
            </p>
          </div>

          <input
            type="text"
            value={newName}
            onChange={handleNewNameChange}
            placeholder="새 이름을 입력해주세요."
            className={styles.input}
          />
          {nameError && <p className={styles.error}>{nameError}</p>}

          <button type="submit" className={styles.button}>
            이름 변경
          </button>

          <button
            type="button"
            className={styles.backButton}
            onClick={() => router.back()} // 이전 페이지로 돌아가기
          >
            뒤로 가기
          </button>
        </form>
      </div>
    </div>
  );
}
