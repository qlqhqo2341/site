# site

아래 페이지에 호스팅 됨.

https://pages.jhan.me

https://qlqhqo2341.github.io/site/

## 게임

게임만 모은 **[Little Arcade 보관함](https://pages.jhan.me/games.html)**에서 종류별 필터, 즐겨찾기, 마지막 게임 이어하기를 사용할 수 있습니다.

- [달빛 물약실](https://pages.jhan.me/moonlit-sort.html): 36개 스테이지의 마법 물 정렬. 액면을 유지하는 붓기 애니메이션, 숨은 색 공개, 단계별 해금과 별 기록, 되돌리기·힌트·빈 병 추가, 자동 저장.
- [밤의 조각](https://pages.jhan.me/night-pieces.html): 8×8 블록 퍼즐. 드래그·터치 배치, 회전, 연속 제거 보너스, 매일 30수 도전, 브라우저 자동 저장.
- [귀가선 2048](https://pages.jhan.me/train-2048.html): 스와이프로 숫자를 합치는 2048.
- [물빛 정렬](https://pages.jhan.me/water-sort.html): 같은 색 물을 한 병에 모으는 4–6색 정렬 퍼즐.
- [별의 길](https://pages.jhan.me/star-path.html): 조각을 회전해 시작점에서 모든 칸으로 빛을 연결하는 퍼즐.
- [불빛 끄기](https://pages.jhan.me/lights-out.html): 누른 칸과 상하좌우 불빛을 바꿔 모두 끄는 논리 퍼즐. 최소 해법에 기반한 힌트.
- [잔상의 정원](https://pages.jhan.me/memory-garden.html): 8–12쌍 그림 기억 게임. 카드 뒤집기, 한 번 전체 보기, 시도 기록.
- [숫자 산책](https://pages.jhan.me/number-trail.html): 3×3·4×4 숫자 슬라이드. 터치·방향키·스와이프 지원.

공통 퍼즐들은 각 HTML에서 `arcade-catalog.js`, `arcade-engines.js`, `arcade-play.js`, `arcade.css`를 불러옵니다. 달빛 물약실은 `potion-engine.js`, `potion-art.js`, `potion.js`, `potion.css`를 사용하고, 힌트 탐색은 `potion-solver.js` Worker에서 실행합니다. 외부 라이브러리나 빌드 과정 없이 정적으로 호스팅할 수 있습니다.

게임 규칙 검증: `node --test tests/*.test.cjs`

## 오프라인 플레이

온라인에서 게임 보관함이나 게임을 열어 **오프라인 준비 완료**를 확인하면, 방문하지 않은 게임까지 모두 저장됩니다. 이후 같은 브라우저에서 보관함과 게임 8개를 오프라인으로 열 수 있습니다. 진행 기록과 즐겨찾기는 기존처럼 브라우저에 남습니다. 브라우저 데이터를 지우면 온라인에서 다시 저장해야 합니다.

새 배포는 파일 전체의 SHA-256이 일치한 뒤 준비되며, 실행 중인 버전은 게임 창을 모두 닫을 때까지 유지됩니다. 오프라인 저장 범위는 보관함과 게임뿐이며 다른 도구 페이지·API·외부 요청에는 적용되지 않습니다. 배포 경로가 `/site/`인 GitHub Pages에서도 동작합니다.

게임·공통 파일·서비스워커를 수정하거나 게임을 추가한 뒤에는 반드시 저장 목록을 다시 생성하고 함께 커밋하세요.

```sh
node scripts/build-offline-cache.cjs
node scripts/build-offline-cache.cjs --check
node --test tests/*.test.cjs
```

`offline-assets.js`는 게임 카탈로그에서 HTML·스타일·스크립트·힌트 Worker 의존성을 수집한 결과입니다. 목록과 파일 내용이 달라지면 테스트가 실패해 갱신을 요구합니다. `games-sw.js`는 파일 검증과 버전별 캐시를, `offline-client.js`는 등록·준비 상태·복구를 담당합니다.
