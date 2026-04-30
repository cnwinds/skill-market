import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-blue-600 text-lg shrink-0">
              <span className="text-xl">⚡</span>
              SkillMarket
            </Link>

            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                }
              >
                首页
              </NavLink>
              <NavLink
                to="/skills"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                }
              >
                全部 Skill
              </NavLink>
              <NavLink
                to="/publish"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                }
              >
                提交 Skill
              </NavLink>
              <NavLink
                to="/market"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                }
              >
                协议
              </NavLink>
              {user?.roles.includes('admin') && (
                <NavLink
                  to="/admin/reviews"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md ${isActive ? 'bg-orange-50 text-orange-700 font-medium' : 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'}`
                  }
                >
                  审核后台
                </NavLink>
              )}
            </nav>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/publisher/skills"
                    className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100"
                  >
                    {user.displayName}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>SkillMarket — SkillChat 技能扩展分发平台</p>
            <div className="flex items-center gap-4">
              <a href="/market" className="hover:text-gray-700">协议</a>
              <a href="/api/v1/skills" className="hover:text-gray-700">API</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
