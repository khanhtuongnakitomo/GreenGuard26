import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/',        label: 'Overview',       icon: '🏠' },
  { to: '/history', label: 'History',        icon: '📋' },
  { to: '/machine', label: 'Machine Status', icon: '🤖' },
] as const;

/**
 * Sidebar — Điều hướng chính của dashboard.
 */
export function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900">🌿 GreenGuard</p>
        <p className="text-xs text-gray-400 mt-0.5">Smart Recycling Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">BK_BIN_01</p>
      </div>
    </aside>
  );
}
