import { QueriesPage } from '../components/queries';
import styles from './MyDashboardsPage.module.css';

export function MyDashboardsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Dashboards</h1>
      </div>
      <div className={styles.content}>
        <QueriesPage />
      </div>
    </div>
  );
}
