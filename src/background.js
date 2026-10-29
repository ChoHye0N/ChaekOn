// 사용자가 직접 누른 경우에만 현재 탭에 패널을 연다. 시작 방법은 세 가지이고 모두 같은 동작이다.
//  - 툴바 아이콘 클릭
//  - 단축키 (manifest의 _execute_action, 아이콘이 클릭된 것과 같은 이벤트로 들어온다)
//  - 페이지 우클릭 메뉴 (툴바가 없는 팝업 창에서도 쓸 수 있다)
// 그 밖의 자동 동작은 없다.
const MENU_ID = 'chaekon-open';
const DEFAULT_TITLE = 'ChaekOn: 이 책을 PDF로 저장';
const UNAVAILABLE_TITLE = 'ChaekOn: 이 페이지에서는 사용할 수 없습니다 (크롬 내부 페이지, 웹 스토어 등)';

async function openPanel(tabId, frameId = 0, url) {
  if (tabId === undefined || tabId < 0) return;
  try {
    // chrome://, 웹 스토어 같은 페이지에는 주입할 수 없다. 오류를 던지지 않고 알린다.
    if (url && !/^https?:/i.test(url)) throw new Error('unsupported url');
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['src/content/loader.js'] });
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: DEFAULT_TITLE });
  } catch {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' });
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setTitle({ tabId, title: UNAVAILABLE_TITLE });
  }
}

chrome.action.onClicked.addListener(tab => openPanel(tab.id, 0, tab.url));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: DEFAULT_TITLE, contexts: ['all'] });
});

// 프레임 안에서 눌렀으면 그 프레임에 연다. 뷰어가 같은 출처 iframe 안에 있어도 동작한다.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab) openPanel(tab.id, info.frameId ?? 0, tab.url);
});
