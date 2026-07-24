import React, { useState, useEffect, useRef } from 'react';
import PlayerView from './components/PlayerView';
import AdminModal from './components/AdminModal';

export default function App() {
  const [steps, setSteps] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [sessionId, setSessionId] = useState('');

  const clickTimerRef = useRef(null);

  // Initialize Session ID
  useEffect(() => {
    let sid = sessionStorage.getItem('interactive_qa_sid');
    if (!sid) {
      sid = 'sid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('interactive_qa_sid', sid);
    }
    setSessionId(sid);
  }, []);

  // Fetch steps and settings
  const fetchData = async () => {
    try {
      const [stepsRes, settingsRes] = await Promise.all([
        fetch('/api/flow/steps'),
        fetch('/api/flow/settings')
      ]);

      const stepsData = await stepsRes.json();
      const settingsData = await settingsRes.json();

      if (stepsData.success) setSteps(stepsData.steps || []);
      if (settingsData.success) {
        const parsed = { ...settingsData.settings };
        if (parsed.bgm_timeline && typeof parsed.bgm_timeline === 'string') {
          try {
            parsed.bgm_timeline = JSON.parse(parsed.bgm_timeline);
          } catch {
            parsed.bgm_timeline = [];
          }
        }
        setSettings(parsed);
      }
    } catch (err) {
      console.error('Error fetching site data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard shortcut listener: Ctrl + Shift + A or Cmd + Shift + A for hidden Admin Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setIsAdminOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Corner multi-click hidden entry logic
  const handleCornerClick = () => {
    setClickCount(prev => {
      const nextCount = prev + 1;
      if (nextCount >= 5) {
        setIsAdminOpen(true);
        return 0;
      }
      return nextCount;
    });

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 2000);
  };

  // API Event helpers
  const handleStartSession = async () => {
    if (!sessionId) return;
    try {
      await fetch('/api/responses/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          deviceInfo: navigator.userAgent
        })
      });
    } catch (err) {
      console.error('Failed to start session on backend:', err);
    }
  };

  const handleRecordAnswer = async (answerData) => {
    if (!sessionId) return;
    try {
      await fetch('/api/responses/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...answerData
        })
      });
    } catch (err) {
      console.error('Failed to record answer:', err);
    }
  };

  const handleLogEvent = async (eventType, detail) => {
    if (!sessionId) return;
    try {
      await fetch('/api/responses/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          eventType,
          detail
        })
      });
    } catch (err) {
      console.error('Failed to log event:', err);
    }
  };

  const handleFinishSession = async (nickname, durationSeconds) => {
    if (!sessionId) return;
    try {
      await fetch('/api/responses/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          nickname,
          durationSeconds
        })
      });
    } catch (err) {
      console.error('Failed to finish session:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm tracking-widest uppercase">LOADING EXPERIENCE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative font-sans antialiased overflow-hidden">
      {/* Hidden Corner Trigger for Admin Mode */}
      <div
        onClick={handleCornerClick}
        title="Hidden Area"
        className="fixed top-0 left-0 w-12 h-12 z-40 cursor-default opacity-0"
      />

      {/* Main Interactive QA Player */}
      <PlayerView
        steps={steps}
        settings={settings}
        onStartSession={handleStartSession}
        onRecordAnswer={handleRecordAnswer}
        onLogEvent={handleLogEvent}
        onFinishSession={handleFinishSession}
      />

      {/* Hidden Admin Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        steps={steps}
        settings={settings}
        onRefreshData={fetchData}
      />
    </div>
  );
}
