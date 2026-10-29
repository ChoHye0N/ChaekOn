// 사용자가 확장 아이콘을 눌렀을 때만 현재 탭에 패널을 연다. 그 밖의 자동 동작은 없다.
chrome.action.onClicked.addListener(tab => {
  if (tab.id === undefined) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content/loader.js'] });
});
