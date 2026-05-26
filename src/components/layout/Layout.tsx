import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <Header hasLicense={true} />
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>

    </div>
  );
}
