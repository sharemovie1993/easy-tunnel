import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import DashboardPage from './pages/DashboardPage';
import OrderPage from './pages/OrderPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { systemApi } from './services/api';

interface SidebarProps {
  onLogout: () => void;
  operatorNumber: string;
  licenseServerUrl?: string;
}

function Sidebar({ onLogout, operatorNumber, licenseServerUrl }: SidebarProps) {
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

        {licenseServerUrl && (
          <div style={{ 
            fontSize: 10, 
            color: 'var(--color-text-dim)', 
            textAlign: 'center', 
            background: 'rgba(34, 197, 94, 0.05)', 
            border: '1px solid rgba(34, 197, 94, 0.15)',
            borderRadius: '6px',
            padding: '6px 8px',
            margin: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)' }}></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={licenseServerUrl}>
              Server: {licenseServerUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
        )}

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
  const [licenseServerUrl, setLicenseServerUrl] = useState<string>('');

  useEffect(() => {
    if (token) {
      systemApi.info()
        .then(res => {
          if (res?.data?.license_server_url) {
            setLicenseServerUrl(res.data.license_server_url);
          }
        })
        .catch(err => console.warn('Failed to fetch system info:', err));
    }
  }, [token]);

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
    setLicenseServerUrl('');
  };

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar onLogout={handleLogout} operatorNumber={operator} licenseServerUrl={licenseServerUrl} />
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
