import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  PlusCircle,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/sales/new', icon: PlusCircle, label: 'New Sale' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/items', icon: Package, label: 'Silver Stock' },
  { to: '/accounts/customer', icon: Users, label: 'Account Summary' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function loadShopName() {
  try {
    const raw = localStorage.getItem('rc_company_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.companyName) return String(s.companyName);
    }
  } catch {
    /* ignore */
  }
  return 'Ritik Chains';
}

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [shopName, setShopName] = useState(loadShopName);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setShopName(loadShopName());
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="px-5 py-5 border-b border-gray-700 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-amber-400 truncate">
            {shopName}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">by ToolClub.website</p>
        </div>
        <button
          type="button"
          className="md:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-300"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )
            }
          >
            <item.icon size={18} className="shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-700 p-4">
        <div className="text-sm font-medium truncate">{user?.fullName}</div>
        <div className="text-xs text-gray-400">{user?.role}</div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(16rem,85vw)] shadow-xl z-50">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-3 py-2.5 bg-gray-900 text-white shrink-0">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-800"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-amber-400 truncate text-sm">
              {shopName}
            </div>
            <div className="text-[10px] text-gray-400 truncate">
              {user?.fullName || 'Menu'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}