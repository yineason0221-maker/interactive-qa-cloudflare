import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

export default function AudioPlayer({ src, paused = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasSrc, setHasSrc] = useState(!!src);
  const audioRef = useRef(null);

  const attemptPlay = async () => {
    if (!audioRef.current || !src) return;
    try {
      audioRef.current.load();
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const attemptPause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };

  useEffect(() => {
    setHasSrc(!!src);
    if (paused) {
      attemptPause();
      return;
    }

    attemptPlay();

    const handleInteraction = () => {
      attemptPlay();
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchend', handleInteraction);
    };

    document.addEventListener('touchstart', handleInteraction, { once: false });
    document.addEventListener('click', handleInteraction, { once: false });
    document.addEventListener('touchend', handleInteraction, { once: false });

    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchend', handleInteraction);
    };
  }, [src, paused]);

  const togglePlay = () => {
    if (!audioRef.current || !src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!hasSrc) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-zinc-900/80 border border-zinc-700/60 px-4 py-2 rounded-full backdrop-blur-md shadow-2xl transition-all hover:scale-105">
      <audio ref={audioRef} src={src} loop preload="auto" />
      <div className="flex items-center gap-2">
        <Music className={`w-4 h-4 ${isPlaying ? 'text-white animate-pulse' : 'text-zinc-500'}`} />
        <span className="text-xs text-zinc-300 font-mono tracking-wider">
          {isPlaying ? 'BGM PLAYING' : 'BGM PAUSED'}
        </span>
      </div>

      <button
        onClick={togglePlay}
        className="text-xs text-zinc-400 hover:text-white underline font-mono"
      >
        {isPlaying ? 'PAUSE' : 'PLAY'}
      </button>

      <button
        onClick={toggleMute}
        className="text-zinc-400 hover:text-white transition-colors"
        title="切換靜音"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
