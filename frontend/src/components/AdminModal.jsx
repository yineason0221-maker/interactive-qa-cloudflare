import React, { useState, useEffect } from 'react';
import AdminAnalytics from './AdminAnalytics';
import AdminFlowEditor from './AdminFlowEditor';
import AdminSettings from './AdminSettings';
import { X, Lock, ShieldAlert, BarChart3, Edit3, Settings, LogOut } from 'lucide-react';

export default function AdminModal({ isOpen, onClose, steps, settings, onRefreshData }) {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'editor', 'settings'

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setPassword('');
      } else {
        setErrorMsg(data.error || '密碼錯誤');
      }
    } catch (err) {
      setErrorMsg('連線伺服器失敗');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('adminToken');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-6xl h-[90vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
        {/* Modal Top Bar */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white tracking-wider font-mono">
              SYSTEM ADMIN MODE
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {token && (
              <button
                onClick={handleLogout}
                className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!token ? (
          /* Login Screen */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6 text-center shadow-xl">
              <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center mx-auto text-white">
                <Lock className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white">控制台身份驗證</h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">預設管理員密碼為: admin</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {errorMsg && (
                  <div className="text-xs font-mono text-red-400 bg-red-950/80 border border-red-800 p-3 rounded-xl">
                    {errorMsg}
                  </div>
                )}

                <input
                  type="password"
                  required
                  placeholder="請輸入管理員密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white rounded-xl px-4 py-3 text-center text-lg focus:border-white focus:outline-none font-mono"
                  autoFocus
                />

                <button
                  type="submit"
                  className="w-full py-3 bg-white text-black font-bold text-base rounded-xl hover:bg-zinc-200 transition-all"
                >
                  解鎖後台管理
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Admin Workspace Navigation & Views */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-6 gap-2 pt-2">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-5 py-3 text-xs font-bold font-mono rounded-t-xl flex items-center gap-2 transition-all border-t border-x ${
                  activeTab === 'analytics'
                    ? 'bg-zinc-950 border-zinc-800 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                回答與停留時間紀錄
              </button>

              <button
                onClick={() => setActiveTab('editor')}
                className={`px-5 py-3 text-xs font-bold font-mono rounded-t-xl flex items-center gap-2 transition-all border-t border-x ${
                  activeTab === 'editor'
                    ? 'bg-zinc-950 border-zinc-800 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                流程與問題內容編輯器
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-5 py-3 text-xs font-bold font-mono rounded-t-xl flex items-center gap-2 transition-all border-t border-x ${
                  activeTab === 'settings'
                    ? 'bg-zinc-950 border-zinc-800 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Settings className="w-4 h-4" />
                密碼與系統設定
              </button>
            </div>

            {/* Tab Panels */}
            <div className="flex-1 p-6 overflow-y-auto bg-zinc-950">
              {activeTab === 'analytics' && <AdminAnalytics token={token} />}
              {activeTab === 'editor' && (
                <AdminFlowEditor
                  token={token}
                  steps={steps}
                  onSaveSuccess={onRefreshData}
                />
              )}
              {activeTab === 'settings' && (
                <AdminSettings
                  token={token}
                  settings={settings}
                  onSettingsUpdated={onRefreshData}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
