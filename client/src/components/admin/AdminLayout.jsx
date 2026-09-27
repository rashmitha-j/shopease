import { NavLink, Outlet } from 'react-router';

const SECTIONS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/reviews', label: 'Reviews' },
];

// Sidebar on large screens, a scrolling tab bar on smaller ones
export default function AdminLayout() {
  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
      <aside className="mb-6 lg:mb-0">
        <p className="mb-3 hidden text-xs font-semibold tracking-wide text-gray-500 uppercase lg:block">Admin</p>
        <nav aria-label="Admin">
          <ul className="-mx-4 flex gap-2 overflow-x-auto border-b border-gray-200 px-4 pb-3 sm:mx-0 sm:px-0 lg:flex-col lg:gap-1 lg:border-0 lg:pb-0">
            {SECTIONS.map((section) => (
              <li key={section.to} className="shrink-0">
                <NavLink
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
