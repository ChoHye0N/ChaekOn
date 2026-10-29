// content script는 ES 모듈이 아니라서, 모듈인 main.js를 동적으로 불러와 패널을 연다.
(async () => {
  const { toggle } = await import(chrome.runtime.getURL('src/content/main.js'));
  await toggle();
})();
