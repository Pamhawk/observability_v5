import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, User, Bell, Lock } from 'lucide-react';
import { currentUser } from '../../data/mockData';
import styles from './Header.module.css';

type ActiveTool = 'EdgeProtect' | 'EdgeAnalytics';

interface HeaderProps {
  hasLicense?: boolean;
}

export function Header({ hasLicense = true }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const edgeAnalyticsPaths = ['/observability', '/my-dashboards', '/my-queries'];
  const activeTool: ActiveTool = edgeAnalyticsPaths.some(p => location.pathname.startsWith(p))
    ? 'EdgeAnalytics'
    : 'EdgeProtect';

  const currentTime = new Date();
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const localTime = `${hours}:${minutes}`;

  // Calculate UTC time
  const utcHours = currentTime.getUTCHours().toString().padStart(2, '0');
  const utcMinutes = currentTime.getUTCMinutes().toString().padStart(2, '0');
  const utcTime = `${utcHours}:${utcMinutes}`;

  const dateStr = currentTime.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });

  const handleToolSwitch = (tool: ActiveTool) => {
    if (tool === 'EdgeAnalytics' && !hasLicense) {
      setShowUpgradeModal(true);
      return;
    }
    if (tool === 'EdgeProtect') {
      navigate('/dashboard');
    } else {
      navigate('/observability');
    }
  };

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          {/* Cisco Logo */}
          <div className={styles.logo}>
            <svg viewBox="0 0 100 52" className={styles.ciscoLogo}>
              <path
                fill="currentColor"
                d="M10 20h5v12h-5zM20 14h5v18h-5zM30 8h5v24h-5zM40 14h5v18h-5zM50 20h5v12h-5zM60 14h5v18h-5zM70 8h5v24h-5zM80 14h5v18h-5zM90 20h5v12h-5z"
              />
            </svg>
          </div>

          {/* Tool Switcher */}
          <div className={styles.toolSwitcher}>
            <button
              className={`${styles.toolBtn} ${activeTool === 'EdgeProtect' ? styles.active : ''}`}
              onClick={() => handleToolSwitch('EdgeProtect')}
            >
              EdgeProtect
            </button>
            <button
              className={`${styles.toolBtn} ${activeTool === 'EdgeAnalytics' ? styles.active : ''} ${!hasLicense ? styles.locked : ''}`}
              onClick={() => handleToolSwitch('EdgeAnalytics')}
            >
              EdgeAnalytics
              {!hasLicense && <Lock size={14} className={styles.lockIcon} />}
            </button>
          </div>
        </div>

        <div className={styles.rightSection}>
          {/* Clock */}
          <div className={styles.clock}>
            <Clock size={16} />
            <div className={styles.clockTimes}>
              <span className={styles.localTime}>{localTime}</span>
              <span className={styles.utcTime}>{utcTime}</span>
              <span className={styles.dateStr}>{dateStr}</span>
            </div>
          </div>

          {/* Notifications */}
          <button className={styles.iconBtn}>
            <Bell size={20} />
          </button>

          {/* User Menu */}
          <div className={styles.userMenu}>
            <button className={styles.userBtn}>
              <User size={20} />
              <span className={styles.userName}>{currentUser.name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowUpgradeModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Upgrade to EdgeAnalytics</h3>
            <p>
              EdgeAnalytics provides advanced network observability features including
              ASN path analysis, custom queries, and traffic insights.
            </p>
            <p>Contact customer support to upgrade your license.</p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowUpgradeModal(false)}
              >
                Cancel
              </button>
              <button className={styles.contactBtn}>
                Contact Support
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
