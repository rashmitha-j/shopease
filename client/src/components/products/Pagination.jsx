import { Link } from 'react-router';
import { getPageItems } from '../../utils/pagination.js';

const base = 'inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-medium';

// Page links are real <a> tags (not buttons), so each page has its own URL
// and works with the back button, new tabs and bookmarks.
export default function Pagination({ page, pages, getSearch }) {
  if (pages <= 1) return null;

  const pageLink = (n, label, extra = {}) => (
    <Link to={{ search: getSearch(n) }} className={`${base} text-slate-700 hover:bg-white hover:shadow-sm`} {...extra}>
      {label}
    </Link>
  );
  const disabled = (label) => <span className={`${base} cursor-not-allowed text-slate-400`}>{label}</span>;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {page > 1 ? pageLink(page - 1, '← Prev', { rel: 'prev' }) : disabled('← Prev')}

      {/* Numbered pages from sm up; phones show "Page x of y" instead */}
      <ul className="hidden items-center gap-1 sm:flex">
        {getPageItems(page, pages).map((item, i) =>
          item === '…' ? (
            <li key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span aria-current="page" className={`${base} bg-linear-to-r from-brand-600 to-purple-600 text-white shadow-md shadow-brand-600/20`}>
                  {item}
                </span>
              ) : (
                pageLink(item, item, { 'aria-label': `Page ${item}` })
              )}
            </li>
          ),
        )}
      </ul>
      <span className="px-2 text-sm text-slate-600 sm:hidden">
        Page {page} of {pages}
      </span>

      {page < pages ? pageLink(page + 1, 'Next →', { rel: 'next' }) : disabled('Next →')}
    </nav>
  );
}
