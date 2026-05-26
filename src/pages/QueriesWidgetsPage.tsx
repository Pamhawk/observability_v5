import { MyQueries } from '../components/queries';
import styles from './MyQueriesPage.module.css';

export function QueriesWidgetsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <MyQueries />
      </div>
    </div>
  );
}
