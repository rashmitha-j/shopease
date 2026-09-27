// Page buttons to show, with '…' for skipped ranges.
// Always shows the first page, the last page and the pages next to the current one:
//   getPageItems(5, 10) -> [1, '…', 4, 5, 6, '…', 10]
//   getPageItems(2, 4)  -> [1, 2, 3, 4]
export function getPageItems(page, pages) {
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);

  const items = [];
  numbers.forEach((n, i) => {
    const prev = numbers[i - 1];
    if (prev !== undefined && n - prev === 2) items.push(prev + 1); // a gap of one page: show it, not '…'
    else if (prev !== undefined && n - prev > 2) items.push('…');
    items.push(n);
  });
  return items;
}
