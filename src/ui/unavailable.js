// 팝업 문구를 실패 이유(?reason=)에 맞춘다. 기본 문구(크롬 내부 페이지)는 HTML에 이미 들어 있다.
const MESSAGES = {
  failed: {
    title: '패널을 열지 못했습니다',
    desc: '이 페이지에는 패널을 열 수 없었습니다. 페이지를 새로고침한 뒤 다시 눌러 주세요. 뷰어가 다른 사이트의 프레임 안에 있다면 지원하지 않습니다.',
  },
};

const message = MESSAGES[new URLSearchParams(location.search).get('reason')];
if (message) {
  document.getElementById('title').textContent = message.title;
  document.getElementById('desc').textContent = message.desc;
}
