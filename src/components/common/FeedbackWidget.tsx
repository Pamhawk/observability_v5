import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import styles from './FeedbackWidget.module.css';

const FEEDBACK_EMAIL = 'feedback@edgeanalytics.cisco.com';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleSend = () => {
    const subject = encodeURIComponent('EdgeAnalytics Feedback');
    const body = encodeURIComponent(message);
    window.open(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`, '_self');
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setMessage('');
      setIsOpen(false);
    }, 2000);
  };

  return (
    <div className={styles.wrapper} ref={panelRef}>
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Share your feedback</div>
              <div className={styles.panelSubtitle}>Missing something? Let us know!</div>
            </div>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>
          {sent ? (
            <div className={styles.sentMessage}>
              Thanks for your feedback!
            </div>
          ) : (
            <>
              <textarea
                className={styles.textarea}
                placeholder="Tell us what you'd like to see, report a bug, or suggest an improvement..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
              />
              <div className={styles.panelFooter}>
                <span className={styles.emailHint}>Opens your email client</span>
                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!message.trim()}
                >
                  <Send size={14} />
                  Send Email
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <button
        className={`${styles.fab} ${isOpen ? styles.fabActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Send us feedback"
      >
        <MessageSquarePlus size={22} />
      </button>
    </div>
  );
}
