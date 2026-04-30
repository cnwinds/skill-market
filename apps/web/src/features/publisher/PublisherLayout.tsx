import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/publisher/skills', label: '我的提交' },
  { to: '/publish', label: '+ 新建提交' },
  { to: '/publisher/keys', label: 'Publish Keys' },
];

export default function PublisherLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row gap-6">
        <aside className="sm:w-48 shrink-0">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">发布者控制台</h2>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
