"use client";

import { useEffect, useRef } from "react";

interface BlackholeBackgroundProps {
  variant?: "intake" | "results";
}

type Particle = {
  radius: number;
  angle: number;
  speed: number;
  size: number;
  alpha: number;
  hue: "bright" | "amber" | "copper";
};

export function BlackholeBackground({ variant = "intake" }: BlackholeBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isResults = variant === "results";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const PARTICLE_COUNT = isResults ? 80 : 180;
    const particles: Particle[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const distNorm = Math.random();
      const radiusMult = 1.25 + Math.pow(distNorm, 1.7) * 3.2;
      const speedMult = (1 / Math.pow(radiusMult, 1.25)) * 0.0065;

      particles.push({
        radius: radiusMult,
        angle: Math.random() * Math.PI * 2,
        speed: speedMult * (0.85 + Math.random() * 0.35),
        size: 0.8 + Math.random() * 1.5,
        alpha: 0.2 + Math.random() * 0.5,
        hue: Math.random() > 0.45 ? "bright" : Math.random() > 0.5 ? "amber" : "copper",
      });
    }

    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const tiltX = 0.32;
    const rotationAngle = -0.25;

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Centered on intake, shifted up and scaled down on results
      const cx = width * 0.5;
      const cy = isResults
        ? Math.max(140, Math.min(height * 0.22, 220))
        : Math.max(200, Math.min(height * 0.36, 350));
      const baseR = isResults
        ? Math.max(38, Math.min(width * 0.045, 58))
        : Math.max(52, Math.min(width * 0.07, 86));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationAngle);

      // Orbiting relativistic Keplerian particles with Doppler beaming
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!prefersReducedMotion) {
          p.angle += p.speed;
          if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
        }

        const orbR = baseR * p.radius;
        const px = Math.cos(p.angle) * orbR;
        const py = Math.sin(p.angle) * orbR * tiltX;

        // Doppler beaming: approaching particles (sin < 0) are brighter
        const doppler = Math.sin(p.angle);
        const intensity = Math.max(0.1, (1 - doppler * 0.6) * p.alpha * (isResults ? 0.45 : 0.85));

        let color = `rgba(225, 240, 225, ${intensity * 0.8})`;
        if (p.hue === "amber") {
          color = `rgba(235, 180, 80, ${intensity * 0.7})`;
        } else if (p.hue === "copper") {
          color = `rgba(195, 95, 45, ${intensity * 0.6})`;
        }

        ctx.beginPath();
        const streakLen = prefersReducedMotion ? 0.02 : p.speed * 20;
        const tx = Math.cos(p.angle - streakLen) * orbR;
        const ty = Math.sin(p.angle - streakLen) * orbR * tiltX;

        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.strokeStyle = color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      ctx.restore();

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isResults]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-opacity duration-1000 ${
        isResults ? "opacity-35" : "opacity-90"
      }`}
      aria-hidden="true"
    >
      {/* Pure CSS Accretion Disk Simulation Layer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 transition-all duration-1000"
        style={{
          top: isResults ? "14%" : "30%",
          width: isResults ? "500px" : "860px",
          height: isResults ? "500px" : "860px",
        }}
      >
        {/* Accretion Disk 3D Perspective Plane */}
        <div
          className="relative h-full w-full"
          style={{
            transform: "rotateX(72deg) rotateZ(32deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Rotating Accretion Disk Layer 1 (Hot Doppler Approaching Limb) */}
          <div
            className="absolute inset-0 rounded-full animate-bh-spin"
            style={{
              background:
                "conic-gradient(from 45deg, rgba(230,245,215,0.45) 0deg, rgba(212,255,63,0.3) 60deg, rgba(210,140,50,0.18) 120deg, rgba(160,65,25,0.06) 200deg, rgba(8,10,14,0) 300deg, rgba(230,245,215,0.45) 360deg)",
              filter: "blur(18px)",
            }}
          />

          {/* Rotating Accretion Disk Layer 2 (Counter-swirl Dust Lanes) */}
          <div
            className="absolute inset-[15%] rounded-full animate-bh-spin-reverse"
            style={{
              background:
                "conic-gradient(from 180deg, rgba(255,255,255,0.5) 0deg, rgba(220,180,90,0.25) 90deg, rgba(140,55,20,0.08) 180deg, rgba(6,8,12,0) 280deg, rgba(255,255,255,0.5) 360deg)",
              filter: "blur(12px)",
            }}
          />

          {/* Innermost Dense Plasma Glow */}
          <div
            className="absolute inset-[32%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(235,250,225,0.55) 0%, rgba(212,255,63,0.35) 45%, rgba(195,115,40,0.15) 75%, transparent 100%)",
              filter: "blur(8px)",
            }}
          />
        </div>

        {/* Relativistic Gravitational Lensing Arc (Bending light over the top of the event horizon) */}
        <div
          className="absolute left-1/2 top-[32%] -translate-x-1/2 h-[34%] w-[70%] rounded-[50%/100%_100%_0_0] animate-lensing"
          style={{
            borderTop: "3px solid rgba(235, 245, 220, 0.4)",
            boxShadow: "0 -8px 24px rgba(212, 255, 63, 0.2), inset 0 6px 16px rgba(235, 175, 75, 0.15)",
            filter: "blur(2px)",
          }}
        />

        {/* Photon Ring (Thin circular razor-edge of trapped photons) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-photon-pulse"
          style={{
            width: isResults ? "90px" : "154px",
            height: isResults ? "90px" : "154px",
            border: "1.5px solid rgba(240, 250, 230, 0.65)",
            boxShadow: "0 0 16px rgba(212, 255, 63, 0.5), inset 0 0 14px rgba(220, 240, 210, 0.4)",
          }}
        />

        {/* Schwarzschild Event Horizon / Central Black Hole Shadow */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#030406]"
          style={{
            width: isResults ? "84px" : "144px",
            height: isResults ? "84px" : "144px",
            boxShadow: "0 0 35px #000000, 0 0 60px rgba(0,0,0,0.95), inset 0 0 25px #000000",
          }}
        />
      </div>

      {/* Dynamic Relativistic Keplerian Particles (Canvas) */}
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Atmospheric Vignette & Contrast Control */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isResults
            ? "bg-[radial-gradient(ellipse_at_50%_25%,transparent_5%,rgba(6,8,11,0.85)_50%,#06080b_85%)]"
            : "bg-[radial-gradient(ellipse_at_50%_35%,transparent_20%,rgba(6,8,11,0.65)_55%,#06080b_90%)]"
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06080b]/50 via-transparent to-[#05070a]/95" />
    </div>
  );
}
