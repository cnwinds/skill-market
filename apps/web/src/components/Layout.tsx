import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { useTheme } from '../contexts/ThemeContext';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
      title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm transition-colors ${
    isActive
      ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800'
  }`;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 dark:bg-gray-900/80 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400 text-lg shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              SkillMarket
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>
                首页
              </NavLink>
              <NavLink to="/skills" className={navLinkClass}>
                探索
              </NavLink>
              <NavLink to="/docs" className={navLinkClass}>
                文档
              </NavLink>
              {user && (
                <NavLink to="/publish" className={navLinkClass}>
                  发布
                </NavLink>
              )}
              {user?.roles.includes('admin') && (
                <NavLink
                  to="/admin/reviews"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 font-medium dark:bg-orange-900/30 dark:text-orange-300'
                        : 'text-orange-600 hover:text-orange-900 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20'
                    }`
                  }
                >
                  审核
                </NavLink>
              )}
            </nav>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <ThemeToggle />

              {user ? (
                <div className="hidden md:flex items-center gap-1">
                  <Link
                    to="/publisher/skills"
                    className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden md:inline-flex text-sm bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                >
                  登录
                </Link>
              )}

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {mobileOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <nav className="px-4 py-3 space-y-1">
              <NavLink to="/" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
                首页
              </NavLink>
              <NavLink to="/skills" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                探索
              </NavLink>
              <NavLink to="/docs" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                文档
              </NavLink>
              {user && (
                <NavLink to="/publish" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  发布
                </NavLink>
              )}
              {user?.roles.includes('admin') && (
                <NavLink to="/admin/reviews" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  审核
                </NavLink>
              )}
            </nav>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              {user ? (
                <div className="space-y-1">
                  <Link
                    to="/publisher/skills"
                    className="block text-sm text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setMobileOpen(false)}
                  >
                    {user.displayName}
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full text-left text-sm text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    退出
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="block text-center text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  onClick={() => setMobileOpen(false)}
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-auto bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <p>SkillMarket — SkillChat 技能扩展分发平台</p>
            <div className="flex items-center gap-4">
              <Link to="/docs" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">文档</Link>
              <a href="/api/v1/skills" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">API</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
