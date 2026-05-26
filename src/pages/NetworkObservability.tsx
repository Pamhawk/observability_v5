import { ASNPathAnalysis } from '../components/asn-path-analysis';
import styles from './NetworkObservability.module.css';

export function NetworkObservability() {
  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1>Network Observability</h1>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <ASNPathAnalysis />
      </div>
    </div>
  );
}
