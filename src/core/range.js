// 저장할 페이지 범위 검증. 입력은 숫자 또는 숫자 문자열이고, 쪽 번호는 1부터 센다.
function toInt(value) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isInteger(n) ? n : null;
}

// 올바르면 { from, to }, 아니면 { error }를 돌려준다.
export function parseRange(from, to, total) {
  const f = toInt(from), t = toInt(to);
  if (f === null || t === null) return { error: '범위에는 정수를 입력해 주세요.' };
  if (f < 1 || t > total) return { error: `쪽 번호는 1에서 ${total} 사이로 입력해 주세요.` };
  if (f > t) return { error: '시작 쪽은 끝 쪽보다 클 수 없습니다.' };
  return { from: f, to: t };
}
