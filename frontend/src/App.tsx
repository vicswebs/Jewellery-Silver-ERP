import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/customers/CustomersPage';
import ItemsPage from './pages/items/ItemsPage';
import SalesPage from './pages/sales/SalesPage';
import NewSalePage from './pages/sales/NewSalePage';
import StockPage from './pages/stock/StockPage';
import SettingsPage from './pages/SettingsPage';
import CustomerAccountPage from './pages/accounts/CustomerAccountPage';
import SilverDeskPage from './pages/silver/SilverDeskPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sales/new" element={<NewSalePage />} />
        <Route path="accounts/customer" element={<CustomerAccountPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
