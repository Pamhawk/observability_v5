import { useState } from 'react';
import { Button } from '../common';
import styles from './SaveDashboardPopup.module.css';

interface SaveDashboardPopupProps {
  initialName?: string;
  initialDescription?: string;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
}

export function SaveDashboardPopup({
  initialName = '',
  initialDescription = '',
  onSave,
  onCancel,
}: SaveDashboardPopupProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim());
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <label className={styles.label}>Dashboard Name</label>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g. TCP View, Daily Overview..."
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <span className={styles.hint}>A short name to identify this dashboard</span>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Description (optional)</label>
        <textarea
          className={styles.textarea}
          placeholder="Describe the purpose of this dashboard..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
        />
        <span className={styles.hint}>Shown as tooltip when hovering over the dashboard name</span>
      </div>
      <div className={styles.footer}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
