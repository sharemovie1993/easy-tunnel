import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import DashboardPage from './pages/DashboardPage';
import OrderPage from './pages/OrderPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

interface SidebarProps {
  onLogout: () => void;
  operatorNumber: string;
}

function Sidebar({ onLogout, operatorNumber }: SidebarProps) {
  const navItems = [
    { to: '/',         icon: '🏠', label: 'Dashboard' },
    { to: '/order',    icon: '➕', label: 'Tambah Tunnel' },
    { to: '/settings', icon: '⚙️', label: 'Pengaturan' }
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🌐</div>
        <div>
          <div className="logo-text">Easy Tunnel</div>
          <div className="logo-sub">Gateway Manager</div>
        </div>
      </div>

      <div className="nav-section-label">Menu</div>

      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', paddingLeft: '12px' }}>
          Operator WA:<br />
          <strong style={{ color: 'var(--color-accent)' }}>+{operatorNumber}</strong>
        </div>
        
        <button
          onClick={onLogout}
          className="nav-item"
          style={{ color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', justifyContent: 'center' }}
        >
          <span className="nav-icon">🔑</span>
          <span>Keluar Sesi</span>
        </button>

        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center' }}>
          Easy Tunnel v1.0.0
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('@easy_tunnel_token'));
  const [operator, setOperator] = useState<string>(localStorage.getItem('@easy_tunnel_operator') || '');

  const handleLoginSuccess = (newToken: string, number: string) => {
    // Format number to clean format
    const cleanNumber = number.replace(/[^0-9]/g, '');
    localStorage.setItem('@easy_tunnel_token', newToken);
    localStorage.setItem('@easy_tunnel_operator', cleanNumber);
    setToken(newToken);
    setOperator(cleanNumber);
  };

  const handleLogout = () => {
    localStorage.removeItem('@easy_tunnel_token');
    localStorage.removeItem('@easy_tunnel_operator');
    setToken(null);
    setOperator('');
  };

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar onLogout={handleLogout} operatorNumber={operator} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/order" element={<OrderPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
