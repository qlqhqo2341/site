# site

아래 페이지에 호스팅 됨.

https://pages.jhan.me

https://qlqhqo2341.github.io/site/

## 게임

게임만 모은 **[Little Arcade 보관함](https://pages.jhan.me/games.html)**에서 종류별 필터, 즐겨찾기, 마지막 게임 이어하기를 사용할 수 있습니다.

- [밤의 조각](https://pages.jhan.me/night-pieces.html): 8×8 블록 퍼즐. 드래그·터치 배치, 회전, 연속 제거 보너스, 매일 30수 도전, 브라우저 자동 저장.
- [귀가선 2048](https://pages.jhan.me/train-2048.html): 스와이프로 숫자를 합치는 2048.
- [물빛 정렬](https://pages.jhan.me/water-sort.html): 같은 색 물을 한 병에 모으는 4–6색 정렬 퍼즐.
- [별의 길](https://pages.jhan.me/star-path.html): 조각을 회전해 시작점에서 모든 칸으로 빛을 연결하는 퍼즐.
- [불빛 끄기](https://pages.jhan.me/lights-out.html): 누른 칸과 상하좌우 불빛을 바꿔 모두 끄는 논리 퍼즐. 최소 해법에 기반한 힌트.
- [잔상의 정원](https://pages.jhan.me/memory-garden.html): 8–12쌍 그림 기억 게임. 카드 뒤집기, 한 번 전체 보기, 시도 기록.
- [숫자 산책](https://pages.jhan.me/number-trail.html): 3×3·4×4 숫자 슬라이드. 터치·방향키·스와이프 지원.

새 게임은 각 HTML에서 `arcade-catalog.js`, `arcade-engines.js`, `arcade-play.js`, `arcade.css`를 불러옵니다. 외부 라이브러리나 빌드 과정 없이 정적으로 호스팅할 수 있습니다.

게임 규칙 검증: `node --test tests/*.test.cjs`
