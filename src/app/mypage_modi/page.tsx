'use client'

import React, { useRef, useState, ChangeEvent } from "react";
import styles from "./page.module.css";

export default function ProfileEdit() {
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [studentNum, setStudentNum] = useState("");
  const [userId, setUserId] = useState("cyj9866"); // 실제 아이디로 초기값 설정
  const [password, setPassword] = useState("");
  const [githubId, setGithubId] = useState("");
  const [instagramId, setInstagramId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [isNameEditable, setIsNameEditable] = useState(false);
  const [isStudentNumEditable, setIsStudentNumEditable] = useState(false);
  const [isPasswordEditable, setIsPasswordEditable] = useState(false);
  const [isGithubIdEditable, setIsGithubIdEditable] = useState(false);
  const [isInstagramIdEditable, setIsInstagramIdEditable] = useState(false);
  const [isWebsiteEditable, setIsWebsiteEditable] = useState(false);

  const handleImgChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setImgPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.container}>

      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <div className={styles.row}>
          <label className={styles.label}>이름</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isNameEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsNameEditable(!isNameEditable)}
          >
            {isNameEditable ? "저장" : "수정"}
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>학번</label>
          <input
            className={styles.input}
            value={studentNum}
            onChange={(e) => setStudentNum(e.target.value)}
            disabled={!isStudentNumEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsStudentNumEditable(!isStudentNumEditable)}
          >
            {isStudentNumEditable ? "저장" : "수정"}
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>이메일</label>
          <input
            className={styles.input}
            value={userId}
            disabled
            readOnly
          />
        </div>

        <div className={styles.row}>
          <label className={styles.label}>비밀번호</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!isPasswordEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsPasswordEditable(!isPasswordEditable)}
          >
            {isPasswordEditable ? "저장" : "수정"}
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>GitHub</label>
          <input
            className={styles.input}
            type="text"
            value={githubId}
            onChange={(e) => setGithubId(e.target.value)}
            disabled={!isGithubIdEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsGithubIdEditable(!isGithubIdEditable)}
          >
            {isGithubIdEditable ? "저장" : "수정"}
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Instagram</label>
          <input
            className={styles.input}
            type="text"
            value={instagramId}
            onChange={(e) => setInstagramId(e.target.value)}
            disabled={!isInstagramIdEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsInstagramIdEditable(!isInstagramIdEditable)}
          >
            {isInstagramIdEditable ? "저장" : "수정"}
          </button>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Website</label>
          <input
            className={styles.input}
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            disabled={!isWebsiteEditable}
          />
          <button
            type="button"
            className={styles.modifyBtn}
            onClick={() => setIsWebsiteEditable(!isWebsiteEditable)}
          >
            {isWebsiteEditable ? "저장" : "수정"}
          </button>
        </div>
      </form>
    </div>
  );
}
