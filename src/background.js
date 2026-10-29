// 사용자가 직접 누른 경우에만 현재 탭에 패널을 연다. 시작 방법은 세 가지이고 모두 같은 동작이다.
//  - 툴바 아이콘 클릭
//  - 단축키 (manifest의 _execute_action, 아이콘이 클릭된 것과 같은 이벤트로 들어온다)
//  - 페이지 우클릭 메뉴 (툴바가 없는 팝업 창에서도 쓸 수 있다)
// 그 밖의 자동 동작은 없다.
const MENU_ID = 'chaekon-open';
const DEFAULT_TITLE = 'ChaekOn: 이 책을 PDF로 저장';
const UNAVAILABLE_TITLE = 'ChaekOn: 이 페이지에서는 사용할 수 없습니다';
const UNAVAILABLE_POPUP = 'src/ui/unavailable.html';

// 패널을 주입할 수 없는 탭에서는 확장 팝업으로 이유를 안내한다. 팝업 지정은 그 탭에만 적용된다.
async function showUnavailable(tabId, reason) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' });
  chrome.action.setBadgeText({ tabId, text: '!' });
  chrome.action.setTitle({ tabId, title: UNAVAILABLE_TITLE });
  try {
    await chrome.action.setPopup({ tabId, popup: `${UNAVAILABLE_POPUP}?reason=${reason}` });
    await chrome.action.openPopup();
  } catch {
    // 팝업을 열 수 없는 환경이면 배지와 툴팁만 남는다.
  }
}

async function openPanel(tabId, frameId = 0, url) {
  if (tabId === undefined || tabId < 0) return;
  // chrome://, 웹 스토어 같은 페이지에는 주입할 수 없다.
  let restricted = !!url && !/^https?:/i.test(url);
  if (!restricted) {
    try {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['src/content/loader.js'] });
      chrome.action.setBadgeText({ tabId, text: '' });
      chrome.action.setTitle({ tabId, title: DEFAULT_TITLE });
      await chrome.action.setPopup({ tabId, popup: '' });
      return;
    } catch (e) {
      restricted = /cannot access|cannot be scripted|extensions gallery/i.test(e?.message ?? '');
    }
  }
  await showUnavailable(tabId, restricted ? 'restricted' : 'failed');
}

chrome.action.onClicked.addListener(tab => openPanel(tab.id, 0, tab.url));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: DEFAULT_TITLE, contexts: ['all'] });
});

// 콘텐츠 스크립트는 설정 페이지를 직접 열 수 없어 background가 대신 연다.
// 책이 툴바 없는 새 창에 있으면 설정 탭이 다른 창에 열려 가려지므로, 그 창을 앞으로 가져온다.
async function openSettings() {
  try {
    await chrome.runtime.openOptionsPage();
    const [tab] = await chrome.tabs.query({ url: chrome.runtime.getURL('src/ui/options.html') + '*' });
    if (!tab) return;
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } catch {
    // 열 수 없는 환경이면 아무것도 하지 않는다.
  }
}

// 변환 진행률을 툴바 아이콘의 배지로 보여 주고, 끝났을 때 그 창이 뒤에 있으면 작업 표시줄에서 깜박여 알린다.
// 배지는 그 탭에만 적용되고, 탭이 다른 페이지로 이동하면 사라진다.
const PROGRESS_STATES = ['running', 'done', 'error', 'cancelled', 'clear'];
const BADGE_COLORS = { running: '#2563eb', done: '#16a34a', error: '#dc2626' };

async function showProgress(tab, { state, percent }) {
  const tabId = tab?.id;
  if (tabId === undefined || tabId < 0 || !PROGRESS_STATES.includes(state)) return;
  const text = state === 'running' ? `${Math.min(100, Math.max(0, Math.round(Number(percent) || 0)))}%`
    : state === 'done' ? '완료'
      : state === 'error' ? '!' : '';
  if (BADGE_COLORS[state]) chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[state] });
  chrome.action.setBadgeText({ tabId, text });
  if (state !== 'done' || tab.windowId === undefined) return;
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (!win.focused) await chrome.windows.update(tab.windowId, { drawAttention: true });
  } catch {
    // 창이 이미 닫혔다면 알릴 곳이 없다.
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'open-options') openSettings();   // 패널의 설정(슬라이더) 버튼
  else if (message?.type === 'progress') showProgress(sender.tab, message);
});

// 프레임 안에서 눌렀으면 그 프레임에 연다. 뷰어가 같은 출처 iframe 안에 있어도 동작한다.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab) openPanel(tab.id, info.frameId ?? 0, tab.url);
});
