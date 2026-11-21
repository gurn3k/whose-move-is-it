// How two counts compare, in words, so no sentence claims "close to" or "about as
// common" without the numbers backing it. Within 20% either way counts as close.
export function compareCounts(a, b) {
  const ratio = a / b;
  if (ratio >= 0.8 && ratio <= 1.25) return { close: true, than: 'close to', common: 'about as common as' };
  return ratio > 1 ? { close: false, than: 'more than', common: 'more common than' } : { close: false, than: 'fewer than', common: 'less common than' };
}
