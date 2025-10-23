import styles from './team.module.css'; // CSS 모듈 임포트

export default function TeamPage() {
  const teamMembers = [
    { name: '신건훈', studentId: '92015192', imageUrl: '/images/1.png' }, // 이미지 경로 수정
    { name: '조혜선', studentId: '92113865', imageUrl: '/images/2.png' }, // 이미지 경로 수정
    { name: '서우석', studentId: '92015178', imageUrl: '/images/3.png' }, // 이미지 경로 수정
    { name: '최윤지', studentId: '92213122', imageUrl: '/images/5.png' }, // 이미지 경로 수정
    { name: '최효영', studentId: '91914391', imageUrl: '/images/4.png' }, // 이미지 경로 수정
    { name: '박이슬', studentId: '92450524', imageUrl: '/images/6.png' }, // 이미지 경로 수정
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>팀원 소개</h1>

      <div className={styles.teamContainer}>
        {teamMembers.map((member, index) => (
          <div key={index} className={styles.personCard}>
            <div className={styles.imgContainer}>
              <img src={member.imageUrl} alt={member.name} />
            </div>
            <h2 className={styles.personName}>{member.name}</h2>
            <p className={styles.studentId}>{member.studentId}</p>
          </div>
        ))}
      </div>
    </div>
  );
}