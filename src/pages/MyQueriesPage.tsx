import { MyQueries } from '../components/queries';
import styles from './MyQueriesPage.module.css';

export function MyQueriesPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Queries</h1>
      </div>
      <div className={styles.content}>
        <MyQueries />
      </div>
    </div>
  );
}
