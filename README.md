<p align="center">
  <img src="assets/icon.svg" alt="ChaekOn 로고" width="96" height="96">
</p>

<h1 align="center">ChaekOn</h1>

<p align="center">
  열람 권한이 있는 이미지형 웹 전자책을, 브라우저 안에서 PDF 한 개로 합쳐 저장합니다.<br>
  원본 화질 그대로, 서버에 부담 없이, 외부로 아무것도 보내지 않고.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Chrome: Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4">
  <img alt="Dependencies: none" src="https://img.shields.io/badge/dependencies-none-brightgreen">
  <img alt="Status: early development" src="https://img.shields.io/badge/status-early%20development-orange">
</p>

> [!IMPORTANT]
> 개발 초기 단계입니다. 크롬에 개발자 모드로 직접 불러와 쓸 수 있지만, 스토어에는 올라가 있지 않습니다. 자동 테스트는 가짜 뷰어(로컬 테스트 서버)로 돌리고, 실제 전자책 뷰어 한 곳에서 직접 동작을 확인했습니다. 지원하는 뷰어 형식은 아래 [설치](#설치-개발-버전) 항목에 적혀 있습니다.

## 설치 (개발 버전)

1. 이 저장소를 내려받습니다.
2. 크롬에서 `chrome://extensions`를 열고 오른쪽 위의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 눌러 이 저장소 폴더를 고릅니다.
4. 전자책 뷰어를 연 탭에서 아래 세 가지 중 하나로 열면 오른쪽 위에 진행률 패널이 뜹니다.
   - 툴바의 ChaekOn 아이콘 클릭
   - 단축키 `Ctrl+Shift+Y`(Mac은 `Command+Shift+Y`). 다른 프로그램과 겹치면 `chrome://extensions/shortcuts`에서 바꿀 수 있습니다
   - 페이지에서 우클릭한 뒤 **ChaekOn: 이 책을 PDF로 저장** 선택
5. 책의 일부만 필요하면 패널의 **범위**에 시작 쪽과 끝 쪽(예: 10 ~ 50)을 입력합니다. 기본은 전체입니다.
6. **PDF 만들기**를 누르고, 끝나면 **PDF 저장**을 누릅니다. 일부만 받았다면 파일 이름에 범위가 붙습니다(예: `책 제목 (10-50쪽).pdf`).

책이 주소창과 툴바가 없는 새 창(팝업 창)으로 열리면 아이콘을 누를 수 없고 뷰어가 우클릭을 막는 경우도 있어서, 그 창의 오른쪽 아래에 **PDF 저장** 버튼이 자동으로 나타납니다. 누르면 같은 진행률 패널이 열립니다. 일반 탭과 일반 창에는 이 버튼이 나타나지 않습니다. 크롬 내부 페이지(`chrome://`)와 웹 스토어에서는 확장이 동작할 수 없어서, "이 페이지에서는 사용할 수 없습니다"라는 안내 창이 뜨고 아이콘에 빨간 `!`가 표시됩니다. 그 탭에서 일반 페이지로 이동하면 안내는 사라집니다.

### 설정

설정 화면은 아래 중 어디서든 열 수 있습니다. 바꾼 값은 바로 저장되고, 다음에 PDF를 만들 때부터 적용됩니다.

- 진행률 패널 오른쪽 위의 설정 버튼(선과 원으로 된 슬라이더 아이콘). 툴바가 없는 새 창에서도 쓸 수 있고, 설정 탭이 다른 창에 가려지지 않도록 그 창을 앞으로 가져옵니다
- 툴바 아이콘 우클릭 후 **옵션**
- `chrome://extensions`에서 ChaekOn의 **세부정보**, **확장 프로그램 옵션**

| 설정 | 내용 |
|---|---|
| 받는 속도 | 매우 천천히(동시 1장, 0.8초), 기본(동시 2장, 0.4초), 조금 빠르게(동시 3장, 0.25초), 직접 설정 |
| 고급 설정 | 동시 요청 수(1~4), 요청 간격(100~5000ms), 재시도 횟수(0~6), 연속 실패 중단 기준(1~10). 접혀 있으며, 값을 고치면 자동으로 "직접 설정"이 됩니다 |
| 새 창 시작 버튼 | 표시 여부와 위치(오른쪽 아래, 왼쪽 아래). 새 창을 다시 열면 적용됩니다 |

**기본값으로 되돌리기** 버튼으로 모든 설정을 처음 상태로 돌릴 수 있습니다. 기본값보다 빠르게 설정하면 서버에 부담을 줄 수 있다는 안내가 표시됩니다. 설정은 `chrome.storage.local`에만 저장되어 이 브라우저 밖으로 나가지 않습니다.

### 진행 표시

변환하는 동안 툴바 아이콘의 배지에 진행률(`42%`)이 표시되고, 끝나면 `완료`로 바뀝니다. 다른 탭이나 창을 보고 있어도 상태를 알 수 있고, 책이 있는 창이 뒤에 있으면 끝났을 때 작업 표시줄에서 깜박여 알려 줍니다. 배지는 그 탭에만 적용되며, 패널을 닫거나 다른 페이지로 이동하면 사라집니다.

### 권한과 개인정보

요청하는 권한은 `activeTab`, `scripting`, `contextMenus`, `storage`(설정 저장용)입니다. 여기에 더해, 툴바가 없는 새 창에 시작 버튼을 띄우기 위해 모든 `http(s)` 페이지에 아주 작은 스크립트(`src/content/launcher.js`)가 로드됩니다. 이 때문에 설치할 때 크롬이 "모든 웹사이트의 데이터 읽기 및 변경" 경고를 보여 줍니다.

- 이 스크립트는 창에 툴바가 있는지만 확인하고, 일반 탭과 일반 창에서는 그 자리에서 끝납니다. 페이지 내용을 읽거나 네트워크 요청을 보내지 않습니다.
- 툴바가 없는 새 창에서도 버튼만 띄웁니다. 버튼을 누르기 전에는 이미지 요청도, 뷰어 확인도 하지 않습니다. 다만 로그인 팝업처럼 툴바가 없는 창에도 버튼이 보일 수 있습니다.
- 설정에서 시작 버튼을 꺼도 스크립트는 그대로 로드되고 버튼만 숨겨집니다. 스크립트 자체를 없애려면 `manifest.json`의 `content_scripts` 항목을 지우면 됩니다. 그러면 새 창에서는 시작 버튼이 사라지고 아이콘, 단축키, 우클릭 메뉴로만 열 수 있습니다.

지원하는 뷰어는 `project.json`을 가진 이미지형 뷰어(`src/adapters/project-json.js`)입니다. 다른 형식은 어댑터를 추가해야 합니다.

## 왜 만들었나

페이지가 이미지로만 제공되는 전자책은 오프라인으로 보관하거나 한 파일로 정리하기 어렵습니다. 이 프로젝트는 이미 로그인해서 열어 둔 뷰어 탭에서, 버튼 한 번으로 PDF 하나를 만드는 것을 목표로 합니다.

## 특징

| | |
|---|---|
| 원본 그대로 | JPEG를 다시 압축하지 않고 바이트 그대로 PDF에 넣습니다. |
| 천천히 | 기본 동시 요청 2장, 요청 사이 간격 400ms. 서버에 부담을 주지 않는 것이 기본값입니다. |
| 눈치 있게 | 429·403이 오면 동시 수를 줄이고 `Retry-After`를 따릅니다. 연속으로 실패하면 멈추고 실패한 페이지를 알려 줍니다. |
| 끊어도 이어서 | 취소할 수 있고, 같은 `cache`로 다시 시작하면 받은 페이지는 건너뜁니다. |
| 가볍게 | 의존성 0, 빌드 단계 없음. 바닐라 JS(ES 모듈)입니다. |
| 안에서만 | 모든 처리는 브라우저 안에서 합니다. 서버 전송, 분석, 텔레메트리가 없습니다. |

## 빠른 시작

Node.js 20 이상 또는 최신 브라우저에서 동작합니다.

```js
import { fetchPages } from './src/core/fetcher.js';
import { buildPdf, readJpegInfo } from './src/core/pdf.js';

const { results, failed, stopped } = await fetchPages(urls, {
  onProgress: ({ done, total, bytes }) => console.log(`${done}/${total}`, bytes),
});

if (failed.length) throw new Error(`받지 못한 페이지: ${failed} (${stopped ?? '일부 실패'})`);

const pdf = buildPdf(results.map(bytes => ({ bytes, ...readJpegInfo(bytes) })));   // Blob
```

취소와 이어받기는 `signal`과 `cache`로 합니다.

```js
const cache = new Map();
const ctrl = new AbortController();

await fetchPages(urls, { cache, signal: ctrl.signal });   // ctrl.abort()로 중단하면 받은 페이지는 cache에 남습니다
await fetchPages(urls, { cache });                         // 이어서 받기: 못 받은 페이지만 요청합니다
```

<details>
<summary><code>fetchPages(urls, options)</code> 옵션과 응답 처리</summary>

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `concurrency` | `2` | 동시 요청 수 |
| `intervalMs` | `400` | 요청 시작 사이 최소 간격(ms) |
| `maxRetries` | `3` | 페이지당 재시도 횟수. 대기는 `backoffMs`부터 2배씩 늘어납니다 |
| `backoffMs` | `1000` | 재시도 대기 기준(ms) |
| `maxConsecutiveFailures` | `3` | 이 수만큼 연속으로 실패하면 중단 |
| `signal` | - | `AbortSignal`. 취소하면 `signal.reason`으로 reject |
| `cache` | 새 `Map` | 이미 받은 페이지(0부터). 이어받기용 |
| `onProgress` | - | `{ done, total, bytes }` 콜백 |
| `fetch` | 전역 `fetch` | 교체 가능(테스트, 다른 출처 처리용) |

| 응답 | 동작 |
|---|---|
| 429, 403 | 동시 수를 1 줄이고(최소 1), `Retry-After`(초 또는 날짜)가 있으면 그만큼, 없으면 백오프만큼 전체가 쉼 |
| 408, 5xx, 네트워크 오류 | 백오프 후 재시도 |
| 그 밖의 4xx(404 등) | 재시도하지 않고 실패 처리 |

반환값은 `{ results, failed, stopped }`입니다. `results`는 페이지 순서의 `Uint8Array`(못 받은 곳은 `undefined`), `failed`는 1부터 센 실패 페이지 번호, `stopped`는 연속 실패로 중단했을 때 `'consecutive-failures'`입니다.

</details>

<details>
<summary><code>buildPdf(images)</code></summary>

`{ bytes, width, height, components }` 배열을 받아 `Blob`을 돌려줍니다. 페이지마다 이미지 한 장을 이미지 크기 그대로의 페이지에 담습니다. 1채널(흑백)과 3채널(컬러) JPEG만 지원하며, 그 밖의 채널 수는 에러입니다. `readJpegInfo(bytes)`로 크기와 채널 수를 읽을 수 있습니다.

</details>

## 동작 방식

1. 사용자가 이미 열어 둔 뷰어 탭에서 버튼을 누르면 시작합니다. 백그라운드에서 자동으로 수집하지 않습니다.
2. 뷰어 어댑터가 현재 페이지를 알아보고 페이지 이미지 URL 목록을 만듭니다.
3. `fetchPages`가 로그인된 탭의 정상 요청으로 이미지를 순서대로 받습니다.
4. `buildPdf`가 JPEG의 크기와 채널 수를 읽어, 페이지마다 이미지 한 장씩 담은 PDF를 만듭니다.

## 자주 묻는 질문

<details>
<summary>DRM이 걸린 책도 되나요?</summary>

아니요. DRM 해제, 로그인·CAPTCHA 우회, 서명 URL 위조 기능은 없고 앞으로도 추가하지 않습니다. 이미 열린 탭이 정상적으로 보내는 요청만 사용합니다.

</details>

<details>
<summary>왜 이렇게 느리게 받나요?</summary>

서버에 부담을 주지 않기 위해서입니다. 기본값은 동시 2장에 400ms 간격이고, 429·403 응답에는 더 느려집니다. 값은 옵션으로 바꿀 수 있지만, 올리는 것은 권하지 않습니다.

</details>

<details>
<summary>아주 큰 책도 되나요?</summary>

받은 이미지는 PDF가 만들어질 때까지 메모리에 두고, 조립하는 순간 한 번 더 잡기 때문에 최대 책 크기의 약 2배가 필요합니다. 500쪽(약 190MB)짜리 가짜 책으로 재 보니 변환 중 탭 메모리가 약 90MB에서 300MB까지 올랐다가, PDF가 완성되고 몇 초 뒤 다시 처음 수준으로 내려왔습니다. 탭이 메모리 부족으로 종료되지 않도록 받은 용량이 1GB를 넘으면 안내 후 멈춥니다. 이때는 패널의 **범위**로 책을 나눠서(예: 1~300쪽, 301~600쪽) 저장하세요.

</details>

<details>
<summary>텍스트 검색이나 목차가 되나요?</summary>

아니요. 결과 PDF는 페이지 이미지만 담습니다. OCR과 목차 생성은 범위에 없습니다.

</details>

<details>
<summary>JPEG가 아닌 이미지는요?</summary>

지원하지 않습니다. CMYK(4채널) JPEG도 에러로 처리합니다.

</details>

## 개발

외부 의존성이 없습니다.

```
npm test
node scripts/verify-pdf.mjs <결과.pdf> [원본이미지폴더]
```

- `tests/`는 `node --test`로 실행하며, 가짜 JPEG와 가짜 `fetch`·시계를 씁니다. 실제 전자책 이미지는 저장소에 넣지 않습니다.
- `scripts/verify-pdf.mjs`는 PDF의 헤더, xref 오프셋, 페이지 순서, JPEG 시작·끝 표시를 검사하고, 원본 폴더를 주면 바이트 단위로 비교합니다.

```
manifest.json           Manifest V3 (권한: activeTab, scripting, contextMenus, storage)
src/background.js       아이콘, 단축키, 우클릭 메뉴로 열었을 때 패널 주입
src/content/            launcher(새 창 시작 버튼), loader(동적 import), main(진행 흐름), 파일 이름 정리
src/ui/panel.js         진행률 패널 (Shadow DOM)
src/ui/options.*        설정 화면 (속도 프리셋, 고급 입력, 새 창 시작 버튼)
src/adapters/           뷰어 어댑터: detect, listPages, title
src/core/pdf.js         이미지 배열 -> PDF Blob
src/core/fetcher.js     동시성, 재시도, 백오프, 취소, 이어받기
src/core/convert.js     URL 목록 -> PDF Blob
src/core/settings.js    설정 기본값, 범위 보정, 저장·읽기
tests/                  node --test (가짜 JPEG, 가짜 fetch, 가짜 뷰어 서버)
scripts/verify-pdf.mjs  생성한 PDF 검증
```

## 용도와 책임

이 도구는 **사용자가 이미 열람 권한을 가진 전자책을 개인 보관용 PDF로 저장**하기 위한 것입니다.

내려받은 자료의 저작권은 원저작자와 서비스 제공자에게 있습니다. 저장한 PDF를 재배포, 공유, 판매하는 것은 이 도구의 용도가 아니며, 해당 서비스의 이용약관과 저작권법을 지킬 책임은 사용자에게 있습니다. 이 도구의 작성자는 오용에 대한 책임을 지지 않습니다.

## 라이선스

[MIT](LICENSE)
