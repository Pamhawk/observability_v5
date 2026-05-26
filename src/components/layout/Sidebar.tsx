import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  FileSearch,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  tooltip: string;
}

const navItems: NavItem[] = [
  {
    id: 'asn-path-analysis',
    label: 'ASN Path Analysis',
    icon: <Activity size={20} />,
    path: '/observability',
    tooltip: 'ASN Path Analysis',
  },
  {
    id: 'my-dashboards',
    label: 'My Dashboards',
    icon: <LayoutDashboard size={20} />,
    path: '/my-dashboards',
    tooltip: 'My Dashboards',
  },
  {
    id: 'queries-widgets',
    label: 'Queries & Widgets',
    icon: <FileSearch size={20} />,
    path: '/queries-widgets',
    tooltip: 'My Queries',
  },
];

const bottomNavItems: NavItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    path: '/settings',
    tooltip: 'Settings',
  },
  {
    id: 'help',
    label: 'Help',
    icon: <HelpCircle size={20} />,
    path: '/help',
    tooltip: 'Help',
  },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}>
      <div className={styles.navSection}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
            title={!isExpanded ? item.tooltip : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {isExpanded && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}
      </div>

      <div className={styles.bottomSection}>
        {bottomNavItems.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''}`}
            onClick={() => navigate(item.path)}
            title={!isExpanded ? item.tooltip : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {isExpanded && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}

        <button
          className={styles.toggleBtn}
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </aside>
  );
}
