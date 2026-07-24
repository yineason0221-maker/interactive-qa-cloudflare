import React, { useState, useEffect } from 'react';
import { KeyRound, Upload, Music, Globe, Trash2, Plus } from 'lucide-react';

export default function AdminSettings({ token, settings, onSettingsUpdated }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState({ text: '', isError: false });

  const [siteTitle, setSiteTitle] = useState('');
  const [bgmUrl, setBgmUrl] = useState('');
  const [forceFullscreen, setForceFullscreen] = useState('true');
  const [bgmTimeline, setBgmTimeline] = useState([]);

  useEffect(() => {
    if (settings) {
      setSiteTitle(settings.site_title || '神秘互動問答');
      setBgmUrl(settings.bgm_url || '');
      setForceFullscreen(settings.force_fullscreen || 'true');
      const tl = settings.bgm_timeline;
      setBgmTimeline((Array.isArray(tl) ? tl : (typeof tl === 'string' ? (() => { try { return JSON.parse(tl); } catch { return []; } })() : [])));
    }
  }, [settings]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMessage({ text: '新密碼與確認密碼不一致', isError: true });
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPwdMessage({ text: '管理員密碼更新成功！請記住新密碼。', isError: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwdMessage({ text: data.error || '密碼更新失敗', isError: true });
      }
    } catch (err) {
      setPwdMessage({ text: '連線錯誤', isError: true });
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/flow/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          site_title: siteTitle,
          bgm_url: bgmUrl,
          bgm_timeline: bgmTimeline,
          force_fullscreen: forceFullscreen
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('全域系統設定已成功儲存！');
        if (onSettingsUpdated) onSettingsUpdated();
      }
    } catch (err) {
      alert('儲存失敗');
    }
  };

  return (
    <div className="space-y-8 text-zinc-100 max-w-4xl mx-auto">
      {/* Site Global Settings */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Globe className="w-5 h-5 text-zinc-400" />
          全域網站設定
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1">網站封面標題</label>
            <input
              type="text"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1">背景音樂網址 (BGM MP3)</label>
            <input
              type="text"
              placeholder="e.g. /uploads/music.mp3 或外部 MP3 連結"
              value={bgmUrl}
              onChange={(e) => setBgmUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={handleSaveSettings}
            className="px-6 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-lg"
          >
            儲存全域設定
          </button>
        </div>
      </div>

      {/* BGM Timeline Section */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Music className="w-5 h-5 text-zinc-400" />
          BGM 時間軸播放列表
        </h3>
        <p className="text-xs text-zinc-400">
          設定多首背景音樂依序輪播，每首播放指定秒數後自動切換下一首。
        </p>

        <div className="space-y-2">
          {bgmTimeline.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <span className="text-xs font-mono text-zinc-500 w-6">{idx + 1}</span>
              <input
                type="text"
                placeholder="/uploads/bgm.mp3"
                value={item.url}
                onChange={(e) => {
                  const updated = [...bgmTimeline];
                  updated[idx] = { ...updated[idx], url: e.target.value };
                  setBgmTimeline(updated);
                }}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white min-w-0"
              />
              <input
                type="number"
                min={5}
                placeholder="秒數"
                value={item.duration}
                onChange={(e) => {
                  const updated = [...bgmTimeline];
                  updated[idx] = { ...updated[idx], duration: parseInt(e.target.value) || 30 };
                  setBgmTimeline(updated);
                }}
                className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <button
                onClick={() => setBgmTimeline(bgmTimeline.filter((_, i) => i !== idx))}
                className="p-2 text-red-400 hover:text-red-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setBgmTimeline([...bgmTimeline, { url: '', duration: 30 }])}
          className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 font-mono pt-1"
        >
          <Plus className="w-3.5 h-3.5" /> 新增 BGM 項目
        </button>

        <p className="text-[10px] text-zinc-500 font-mono">
          切換 BGM 時會自動無縫銜接。儲存全域設定後生效。
        </p>
      </div>

      {/* Media Assets Section */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Music className="w-5 h-5 text-zinc-400" />
          媒體檔案使用方式
        </h3>

        <p className="text-xs text-zinc-400">
          這個 0 成本版本不內建後台上傳。若要使用 MP3 或 MP4，請把檔案放到
          <span className="text-white"> frontend/public/uploads/</span>，重新部署後就能用
          <span className="text-white"> /uploads/檔名.mp3</span> 這種靜態路徑；也可以直接貼外部網址。
        </p>
      </div>

      {/* Data Management */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Upload className="w-5 h-5 text-zinc-400" />
          設定資料備份與還原
        </h3>
        <p className="text-xs text-zinc-400">
          匯出一份 JSON 備份檔案，內含所有問題流程與設定。可於更換平台或重新部屬後匯入還原。
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ExportButton token={token} onImported={onSettingsUpdated} />
          <ImportButton token={token} onImported={onSettingsUpdated} />
        </div>
      </div>

      {/* Password Management */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
          <KeyRound className="w-5 h-5 text-zinc-400" />
          修改管理員登入密碼 (預設: admin)
        </h3>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {pwdMessage.text && (
            <div className={`p-3 rounded-xl text-xs font-mono border ${
              pwdMessage.isError ? 'bg-red-950/60 border-red-800 text-red-300' : 'bg-green-950/60 border-green-800 text-green-300'
            }`}>
              {pwdMessage.text}
            </div>
          )}

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1">當前舊密碼</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1">設定新密碼</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 block mb-1">再次確認新密碼</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl border border-zinc-700 transition-colors"
          >
            更新管理員密碼
          </button>
        </form>
      </div>
    </div>
  );
}

function ExportButton({ token, onImported }) {
  const handleExport = async () => {
    try {
      const res = await fetch('/api/flow/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('備份 zip 已下載！包含 steps 與 settings。');
    } catch {
      alert('匯出失敗');
    }
  };

  return (
    <button onClick={handleExport} className="px-4 py-2 bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 text-xs font-mono rounded-xl flex items-center gap-2 transition-colors">
      <Upload className="w-3.5 h-3.5" /> 匯出完整備份 (ZIP)
    </button>
  );
}

function ImportButton({ token, onImported }) {
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('backup', file);

      const res = await fetch('/api/flow/import-zip', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const result = await res.json();
      if (result.success) {
        alert(`匯入成功！${result.message}`);
        if (onImported) onImported();
      } else {
        alert(result.error || '匯入失敗');
      }
    } catch {
      alert('無法讀取備份檔案');
    }
    e.target.value = '';
  };

  return (
    <label className="px-4 py-2 bg-green-900/60 hover:bg-green-800 text-green-200 border border-green-700/60 text-xs font-mono rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
      <Upload className="w-3.5 h-3.5" /> 還原備份 (ZIP)
      <input type="file" accept=".zip" onChange={handleImport} className="hidden" />
    </label>
  );
}
