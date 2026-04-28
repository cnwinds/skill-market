import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row gap-6">
        <aside className="sm:w-48 shrink-0">
          <h2 className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-3">管理员后台</h2>
          <nav className="space-y-1">
            <NavLink
              to="/admin/reviews"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              审核队列
            </NavLink>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
