// Simple line icons for the six catalogue categories (a shopping bag for anything else)
const PATHS = {
  Electronics: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="1.75" />
      <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.75" />
    </>
  ),
  Fashion: <path d="M8.5 3.5 4 5.5 2.5 10l3.5 1.25V20.5h12v-9.25L21.5 10 20 5.5l-4.5-2a3.5 3.5 0 0 1-7 0Z" />,
  Home: (
    <>
      <path d="M3 11 12 3.5l9 7.5" />
      <path d="M5.5 9.5v11h13v-11" />
      <path d="M10 20.5v-5.5h4v5.5" />
    </>
  ),
  Books: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
      <path d="M9 7h6" />
    </>
  ),
  Sports: (
    <>
      <path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11" />
    </>
  ),
  Beauty: (
    <>
      <path d="M11 3.5 12.9 8.6 18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9L11 3.5Z" />
      <path d="M18.5 15.5v5M16 18h5" />
    </>
  ),
};

const BAG = (
  <>
    <path d="M5 8h14l-1 12.5H6L5 8Z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </>
);

export default function CategoryIcon({ category, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[category] ?? BAG}
    </svg>
  );
}
