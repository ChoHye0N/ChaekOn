// 툴바가 없는 창에 띄우는 시작 버튼. 누르면 아이콘을 눌렀을 때와 같은 패널을 연다.
import { toggle } from './main.js';

const ID = 'chaekon-launcher';
const LABEL = 'ChaekOn: 이 책을 PDF로 저장';

const HTML = `
  <style>
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; }
    button { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border: 0; border-radius: 10px;
             background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
             box-shadow: 0 4px 14px rgba(0,0,0,.28); }
    button:hover { background: #1d4ed8; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    svg { width: 28px; height: 28px; display: block; }
  </style>
  <button id="b" type="button" title="${LABEL}" aria-label="${LABEL}">
    <svg viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" rx="28" fill="#fff"/>
      <path d="M26 38c14-4 27-1 36 6v48c-9-7-22-10-36-6z" fill="#2563eb"/>
      <path d="M102 38c-14-4-27-1-36 6v48c9-7 22-10 36-6z" fill="#93c5fd"/>
    </svg>
    <span>PDF 저장</span>
  </button>`;

// onClick은 테스트에서 바꿔 끼울 수 있다.
export function showLauncher(doc = document, { onClick = () => toggle(doc) } = {}) {
  if (doc.getElementById(ID)) return null;
  const host = doc.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = HTML;
  (doc.body ?? doc.documentElement).appendChild(host);
  root.getElementById('b').addEventListener('click', () => onClick());
  return host;
}
