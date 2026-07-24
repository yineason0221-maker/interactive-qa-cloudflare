import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export default function EffectsCanvas({ effectType, duration = 3, onComplete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    let timerId;

    if (effectType === 'fireworks') {
      // Confetti / Fireworks burst
      const count = 200;
      const defaults = {
        origin: { y: 0.7 }
      };

      function fire(particleRatio, opts) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });

      const interval = setInterval(() => {
        confetti({
          particleCount: 40,
          angle: Math.random() * 360,
          spread: 70,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#ffffff', '#00ffcc', '#ff0055', '#ffff00']
        });
      }, 500);

      timerId = setTimeout(() => {
        clearInterval(interval);
        if (onComplete) onComplete();
      }, duration * 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timerId);
      };
    }

    if (effectType === 'matrix') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+<>?/\\{}[]';
      const fontSize = 16;
      const columns = Math.floor(canvas.width / fontSize);
      const drops = Array(columns).fill(1);

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff'; // Modern clean white matrix or #00ff66
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
          const text = chars.charAt(Math.floor(Math.random() * chars.length));
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);

          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
        animationFrameId = requestAnimationFrame(draw);
      };

      draw();

      timerId = setTimeout(() => {
        cancelAnimationFrame(animationFrameId);
        if (onComplete) onComplete();
      }, duration * 1000);

      return () => {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(timerId);
      };
    }

    if (effectType === 'glitch') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const drawGlitch = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Random noise slices
        for (let i = 0; i < 15; i++) {
          const y = Math.random() * canvas.height;
          const h = Math.random() * 20 + 2;
          const x = Math.random() * 50 - 25;
          ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#444444';
          ctx.fillRect(x, y, canvas.width, h);
        }

        animationFrameId = requestAnimationFrame(drawGlitch);
      };

      drawGlitch();

      timerId = setTimeout(() => {
        cancelAnimationFrame(animationFrameId);
        if (onComplete) onComplete();
      }, duration * 1000);

      return () => {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(timerId);
      };
    }

    // Auto complete timer for other effects like 'shake' or 'flash'
    timerId = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration * 1000);

    return () => clearTimeout(timerId);
  }, [effectType, duration, onComplete]);

  if (effectType === 'shake') {
    return (
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center bg-black animate-shake z-40">
        <div className="text-6xl font-bold text-white tracking-widest uppercase glitch-text">
          SYSTEM ALERT
        </div>
      </div>
    );
  }

  if (effectType === 'flash') {
    return (
      <div className="fixed inset-0 pointer-events-none bg-white animate-pulse z-40"></div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 w-full h-full"
    />
  );
}
