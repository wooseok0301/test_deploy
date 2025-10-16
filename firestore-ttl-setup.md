# Firestore TTL 설정 방법

## 1. Firebase 콘솔 접속

- https://console.firebase.google.com 접속
- 프로젝트 선택

## 2. Firestore Database로 이동

- 왼쪽 메뉴에서 "Firestore Database" 클릭
- "데이터" 탭 선택

## 3. TTL 정책 설정

- 상단의 "정책" 탭 클릭
- "TTL(Time To Live) 정책" 섹션에서 "정책 만들기" 클릭

## 4. loginAttempts 컬렉션 TTL 설정

- 컬렉션: `loginAttempts`
- 필드: `lastAttemptAt`
- TTL: 5분 (300초)

## 5. pendingUsers 컬렉션 TTL 설정

- 컬렉션: `pendingUsers`
- 필드: `requestedAt`
- TTL: 1시간 (3600초)

## 6. 정책 활성화

- 각 정책을 "활성화" 상태로 변경
- 변경사항 저장

## 주의사항

- TTL 정책은 Firestore 서버에서 자동으로 실행됩니다
- 클라이언트 코드에서 별도 정리 로직이 필요 없습니다
- 정책 적용까지 몇 분 소요될 수 있습니다
