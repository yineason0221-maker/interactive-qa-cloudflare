import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Clock, MessageSquare, Activity, User, AlertCircle } from 'lucide-react';

export default function AdminAnalytics({ token }) {
  const [analyticsData, setAnalyticsData] = useState([]);
  const [incompleteData, setIncompleteData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeView, setActiveView] = useState('all');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [mainRes, incompleteRes] = await Promise.all([
        fetch('/api/responses/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/responses/incomplete', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const mainData = await mainRes.json();
      const incompleteResult = await incompleteRes.json();

      if (mainData.success) setAnalyticsData(mainData.sessions || []);
      if (incompleteResult.success) setIncompleteData(incompleteResult.sessions || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleClearAll = async () => {
    try {
      const res = await fetch('/api/responses/clear-all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnalyticsData([]);
        setSelectedSession(null);
        setShowClearConfirm(false);
        alert('所有使用者紀錄與數據已成功清空！');
      }
    } catch (err) {
      alert('清空紀錄失敗');
    }
  };

  const parseLocalDateTime = (timeStr) => {
    if (!timeStr) return new Date();
    const normalized = timeStr.replace(' ', 'T');
    const withZ = normalized.endsWith('Z') ? normalized : normalized + 'Z';
    const d = new Date(withZ);
    return isNaN(d.getTime()) ? new Date(timeStr) : d;
  };

  const formatDuration = (seconds, startTime, endTime) => {
    if (endTime) {
      const start = startTime ? new Date(startTime).getTime() : 0;
      const end = new Date(endTime).getTime();
      if (start > 0 && end > start) {
        const computed = Math.round((end - start) / 1000);
        const m = Math.floor(computed / 60);
        const s = computed % 60;
        return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
      }
    }
    if (!seconds && seconds !== 0) return '未完成 / 作答中';
    if (seconds === null || seconds === undefined) return '進行中...';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
  };

  const formatDwellTime = (seconds) => {
    if (!seconds && seconds !== 0) return '計算中...';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    const s = seconds % 60;
    if (h > 0) return `${h} 小時 ${m % 60} 分 ${s} 秒`;
    if (m > 0) return `${m} 分 ${s} 秒`;
    return `${s} 秒`;
  };

  const getStatusInfo = (session) => {
    if (session.end_time) {
      return { label: '已完成', color: 'text-green-400 bg-green-950/50 border-green-800/60', icon: '✓' };
    }
    return { label: '作答中', color: 'text-yellow-400 bg-yellow-950/50 border-yellow-700/60', icon: '⏳' };
  };

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <User className="w-5 h-5 text-zinc-400" />
            使用者作答與停留時間分析 ({analyticsData.length} 人次)
            {incompleteData.length > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-yellow-950/60 text-yellow-400 border border-yellow-700/60 animate-pulse">
                {incompleteData.length} 位仍作答中
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">查看每名受訪者的作答內容、停留秒數與行為軌跡</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono rounded-xl flex items-center gap-2 border border-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新數據
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 text-xs font-mono rounded-xl flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            一鍵清空所有紀錄
          </button>
        </div>
      </div>

      {/* INCOMPLETE SESSIONS SECTION */}
      {incompleteData.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-700/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
              仍作答中 ({incompleteData.length} 位使用者)
            </h3>
            <span className="text-[10px] text-yellow-500/70 font-mono">未完成的紀錄建議仍定期備份，尤其是跨平台遷移前</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {incompleteData.map((session, idx) => {
              const status = getStatusInfo(session);
              return (
                <div
                  key={session.session_id}
                  onClick={() => { setSelectedSession(session); setActiveView('incomplete'); }}
                  className="p-4 rounded-2xl border border-yellow-700/40 bg-yellow-950/30 text-zinc-300 hover:border-yellow-500 cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-base text-white">
                      {session.nickname || `訪客 #${idx + 1}`}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="w-3 h-3 text-yellow-400" />
                      <span className="text-yellow-300 font-bold font-mono">
                        停留 {formatDwellTime(session.dwell_seconds)}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                       開始於 {parseLocalDateTime(session.start_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                    </div>
                    {session.lastStepTitle && (
                      <div className="text-[10px] text-zinc-400 truncate">
                        最後題目: {session.lastStepTitle}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-600">
                      已回答 {session.answerCount || 0} 題
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Analytics Table & Detail View */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 font-mono">載入歷史紀錄中...</div>
      ) : analyticsData.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl text-zinc-500">
          尚無使用者作答紀錄
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User List */}
          <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {analyticsData.map((session, idx) => {
              const isSelected = selectedSession?.session_id === session.session_id;
              const isIncomplete = !session.end_time;
              const status = getStatusInfo(session);
              const dwellSecs = isIncomplete && !session.dwell_seconds
                ? Math.round((Date.now() - parseLocalDateTime(session.start_time).getTime()) / 1000)
                : (session.duration_seconds || 0);

              return (
                <div
                  key={session.session_id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? isIncomplete ? 'bg-yellow-900/30 border-yellow-500 text-white shadow-lg' : 'bg-zinc-800 border-white text-white shadow-lg'
                      : isIncomplete ? 'bg-yellow-950/30 border-yellow-700/40 text-yellow-100 hover:border-yellow-500' : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-base text-white">
                      {session.nickname || `訪客 #${idx + 1}`}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${status.color}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className={`w-3 h-3 ${isIncomplete ? 'text-yellow-400' : 'text-zinc-400'}`} />
                      <span className={`font-mono ${isIncomplete ? 'text-yellow-300 font-bold' : 'text-zinc-400'}`}>
                        {isIncomplete ? `停留 ${formatDwellTime(dwellSecs)}` : formatDuration(session.duration_seconds)}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {parseLocalDateTime(session.start_time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                    </div>
                    {session.device_info && (
                      <div className="truncate text-[10px] text-zinc-600">ID: {session.session_id}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Responses / Logs */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-h-[600px] overflow-y-auto">
            {selectedSession ? (
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      {selectedSession.nickname || '匿名使用者'}
                      {!selectedSession.end_time && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-yellow-950/60 text-yellow-400 border border-yellow-700/60 animate-pulse">
                          ⏳ 作答中
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400 mt-1">
                      Session: {selectedSession.session_id} | 裝置: {selectedSession.device_info || '一般瀏覽器'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 font-mono block">
                      {selectedSession.end_time ? '停留總時間' : '已停留'}
                    </span>
                    <span className={`text-lg font-bold font-mono ${!selectedSession.end_time ? 'text-yellow-300' : 'text-white'}`}>
                      {selectedSession.end_time
                        ? formatDuration(selectedSession.duration_seconds, selectedSession.start_time, selectedSession.end_time)
                        : formatDwellTime(selectedSession.dwell_seconds || (Math.round((Date.now() - parseLocalDateTime(selectedSession.start_time).getTime()) / 1000)))
                      }
                    </span>
                  </div>
                </div>

                {/* Question Answers */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-400" />
                    回答內容紀錄 ({selectedSession.answers?.length || 0} 題)
                    {!selectedSession.end_time && <span className="text-[10px] text-yellow-500 font-mono normal-case">(未完成 - 使用者可能離開)</span>}
                  </h4>

                  {selectedSession.answers && selectedSession.answers.length > 0 ? (
                    <div className="space-y-3">
                      {selectedSession.answers.map((ans, i) => (
                        <div key={i} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                          <div className="text-xs text-zinc-500 font-mono mb-1">
                            {ans.step_title ? `[${ans.step_title}] ` : ''}{ans.question_text}
                          </div>
                          <div className="text-base font-semibold text-white mt-1">
                            {ans.answer_value || '<無填寫>'}
                          </div>
                          <div className="text-[10px] text-zinc-600 font-mono mt-1">
                            {parseLocalDateTime(ans.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">尚無問題回答紀錄</p>
                  )}
                </div>

                {/* Event Logs */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-zinc-400" />
                    操作軌跡與行為紀錄 ({selectedSession.logs?.length || 0} 事件)
                  </h4>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(selectedSession.logs || []).map((log, i) => (
                      <div key={i} className="text-xs font-mono flex justify-between items-center bg-zinc-950/50 px-3 py-2 rounded-lg text-zinc-400 border border-zinc-800/40">
                        <span className="text-white font-semibold">{log.event_type}</span>
                        <span className="text-zinc-500">{log.detail}</span>
                        <span className="text-zinc-600">{parseLocalDateTime(log.created_at).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-24 text-zinc-500 font-mono">
                ← 請點擊左侧列表檢視該位使用者的回答與停留時間
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-red-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <h3 className="text-xl font-bold text-red-400">確定要一鍵清空所有紀錄？</h3>
            <p className="text-sm text-zinc-300">
              此操作將永久刪除所有受訪者的回答內容、停留時間與動作日誌，無法復原。
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-xs hover:bg-zinc-700"
              >
                取消
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-500"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
