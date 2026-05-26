import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import { NetworkObservability } from './pages/NetworkObservability';
import { EdgeProtectDashboard } from './pages/EdgeProtectDashboard';
import { MyDashboardsPage } from './pages/MyDashboardsPage';
import { QueriesWidgetsPage } from './pages/QueriesWidgetsPage';
import './styles/globals.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<EdgeProtectDashboard />} />
          <Route path="/observability" element={<NetworkObservability />} />
          <Route path="/my-dashboards" element={<MyDashboardsPage />} />
          <Route path="/queries-widgets" element={<QueriesWidgetsPage />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
          <Route path="/help" element={<HelpPlaceholder />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

// Placeholder components
function SettingsPlaceholder() {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Settings</h1>
      <p>Settings page coming soon...</p>
    </div>
  );
}

function HelpPlaceholder() {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Help</h1>
      <p>Help documentation coming soon...</p>
    </div>
  );
}

export default App;
