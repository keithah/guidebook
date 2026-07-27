// Static `times` strings in sfcottage.json (e.g. "4, 16′") are the fallback
// display whenever live 511 data isn't available (see lib/transit511.js).
export function firstMinutes(timesStr) {
  const m = /(\d+)/.exec(timesStr || '');
  return m ? parseInt(m[1], 10) : null;
}

export function liveOrStaticMinutesList(liveResult, staticTimesStr) {
  if (liveResult && liveResult.ok && liveResult.minutesList.length) {
    return liveResult.minutesList;
  }
  const m = (staticTimesStr || '').match(/\d+/g) || [];
  return m.map((n) => parseInt(n, 10));
}

export function formatMinutesList(list) {
  if (!list.length) return '—';
  return list.map((n) => n + '′').join(', ');
}
