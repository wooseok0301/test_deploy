import styles from './event.module.css'; 

export default function EventAnnouncementsPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>재학생 참여 이벤트 안내</h1>

      <div className={styles.contentSection}>
       <img src="/popup5.png" alt="재학생 참여 이벤트" className={styles.eventImage} />
        
        <p className={styles.description}>
          본 서비스는 4학년 졸업작품 프로젝트팀과 <br></br>재학생들 간의 교류를 증진하기 위해 만들어졌습니다.<br></br>
          회원가입 하시고 좋아요와 댓글로 많은 참여 바랍니다. 
        </p>

        <div className={styles.announcementCard}>
          <h2 className={styles.cardTitle}>이벤트 참여 방법</h2>
          <ul className={styles.participationList}>
            <li>1. 회원가입 후 로그인 해주세요.</li>
            <li>2. 관심 있는 4학년 졸업작품 프로젝트 팀의 게시물에 좋아요, 댓글을 작성해주세요.</li>
            <li>3. 프로젝트 팀에게 응원과 피드백을 담은 댓글을 작성해주세요.</li>
          </ul>
        </div>

        <div className={styles.rewardsSection}>
          <div className={styles.rewardItem}>
            <h2 className={styles.rewardTitle}>🏆 명예의 전당 선정</h2>
            <p className={styles.rewardDetail}>
              가장 많은 좋아요, 댓글을 받아 명예의 전당에 선정된 <strong>상위 3팀</strong>에게 <span className={styles.highlight}>학과장상</span>을 시상합니다.
            </p>
          </div>
          <div className={styles.rewardItem}>
            <h2 className={styles.rewardTitle}>🎁 정성스런 댓글 이벤트</h2>
            <p className={styles.rewardDetail}>
              정성스럽고 유익한 댓글을 작성해주신 <br></br><strong>3분</strong>을 선정하여 <span className={styles.highlight}>문화상품권</span>을 증정합니다.
            </p>
          </div>
        </div>

        <p className={styles.closingRemarks}>
          지금 바로 참여하세요!
        </p>
      </div>
    </div>
  );
}