// 툴바가 없는 새 창(window.open으로 연 팝업 창)에서는 확장 아이콘, 단축키, 우클릭을 쓸 수 없다.
// 그런 창에서만 "PDF 저장" 버튼을 띄운다. 모든 http(s) 페이지에 로드되지만 일반 탭·창에서는
// 아래 검사에서 곧바로 끝나며, 페이지를 읽거나 네트워크 요청을 보내지 않는다.
(() => {
  if (window.top !== window) return;
  const noToolbar = window.toolbar?.visible === false || window.locationbar?.visible === false;
  if (!noToolbar) return;
  import(chrome.runtime.getURL('src/content/launcher-ui.js'))
    .then(m => m.showLauncher())
    .catch(() => {});   // 확장이 갱신돼 컨텍스트가 끊긴 경우: 페이지를 새로고침하면 된다
})();
