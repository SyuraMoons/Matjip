"use client";

import { useMemo, useState } from "react";
import { useAppKit } from "@reown/appkit/react";

type Dust = {
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
};

function makeDustField(count: number): Dust[] {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const sign = () => (Math.random() < 0.5 ? -1 : 1);
  return Array.from({ length: count }, () => ({
    left: rand(0, 100),
    top: rand(0, 100),
    size: rand(1, 2.8),
    duration: rand(14, 32),
    delay: rand(-30, 0),
    opacity: rand(0.45, 0.9),
    dx: sign() * rand(30, 140),
    dy: sign() * rand(30, 140),
    sx: sign() * rand(8, 22),
    sy: sign() * rand(8, 22),
  }));
}

export default function SignInPage() {
  const { open } = useAppKit();
  const [isOpening, setIsOpening] = useState(false);
  const dust = useMemo(() => makeDustField(80), []);

  const handleContinue = async () => {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await open();
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12"
      style={{
        backgroundColor: "#5a371c",
        backgroundImage: "url('/desk.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative z-10 flex flex-col items-center">
      <button
        type="button"
        onClick={handleContinue}
        disabled={isOpening}
        aria-label="Open matjib"
        className="group relative cursor-pointer bg-transparent p-0 transition-transform duration-300 ease-out hover:-translate-y-2 disabled:cursor-wait"
        style={{
          filter: "drop-shadow(4px 8px 10px rgba(0, 0, 0, 0.35))",
        }}
      >
        <img
          src="/book.png"
          alt="matjib"
          className="block h-auto w-[320px] select-none"
          draggable={false}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute select-none"
          style={{
            top: "13%",
            left: "10.2%",
            writingMode: "vertical-rl",
            fontFamily:
              "'Noto Serif KR', 'Nanum Myeongjo', 'Batang', serif",
            fontWeight: 600,
            fontSize: "56px",
            letterSpacing: "0.1em",
            color: "#2a1a0a",
            textShadow: "0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          맛집
        </div>
        {isOpening && (
          <span
            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
            style={{
              borderColor: "rgba(232, 198, 116, 0.3)",
              borderTopColor: "#e8c674",
              animation: "spin 0.7s linear infinite",
            }}
          />
        )}
      </button>

        <svg
          className="mt-10"
          width="38"
          height="48"
          viewBox="0 0 38 48"
          aria-hidden
          style={{
            filter:
              "drop-shadow(0 1px 0 rgba(255, 220, 170, 0.18)) drop-shadow(0 -1px 0 rgba(0, 0, 0, 0.5))",
          }}
        >
          <path
            d="M19 4 L34 22 L26 22 L26 44 L12 44 L12 22 L4 22 Z"
            fill="rgba(20, 10, 4, 0.55)"
            stroke="rgba(0, 0, 0, 0.35)"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, transparent 5%, rgba(255, 240, 210, 0.13) 40%, transparent 75%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 20%, rgba(0, 0, 0, 0.55) 70%, rgba(0, 0, 0, 0.9) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {dust.map((d, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              background:
                "radial-gradient(circle, rgba(255,240,210,0.95) 0%, rgba(255,240,210,0.3) 60%, transparent 100%)",
              filter: "blur(0.5px)",
              animation: `dustDrift ${d.duration}s linear ${d.delay}s infinite`,
              ["--dust-opacity" as string]: d.opacity,
              ["--dust-dx" as string]: `${d.dx}px`,
              ["--dust-dy" as string]: `${d.dy}px`,
              ["--dust-sx" as string]: `${d.sx}px`,
              ["--dust-sy" as string]: `${d.sy}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
