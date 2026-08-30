import React from "react";

interface SkylarkLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const SkylarkLogo: React.FC<SkylarkLogoProps> = ({
  className = "",
  size = 36,
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-2 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 transition-all hover:scale-105"
        style={{ width: size, height: size }}
      >
        {/* Skylark Drone Vector Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full text-white drop-shadow-md"
        >
          {/* Drone Arms & Body Frame */}
          <path d="M12 8V4M12 16v4M8 12H4M16 12h4" strokeOpacity="0.4" />
          <path d="M6 6l4 4M18 18l-4-4M18 6l-4 4M6 18l4-4" />
          
          {/* 4 Rotors / Propeller Circles */}
          <circle cx="5" cy="5" r="2.5" className="fill-cyan-400/20 stroke-cyan-200" strokeWidth="1.5" />
          <circle cx="19" cy="5" r="2.5" className="fill-cyan-400/20 stroke-cyan-200" strokeWidth="1.5" />
          <circle cx="5" cy="19" r="2.5" className="fill-cyan-400/20 stroke-cyan-200" strokeWidth="1.5" />
          <circle cx="19" cy="19" r="2.5" className="fill-cyan-400/20 stroke-cyan-200" strokeWidth="1.5" />
          
          {/* Central AI/Camera Core */}
          <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" className="fill-white stroke-indigo-900" strokeWidth="1" />
          <circle cx="12" cy="12" r="1" className="fill-indigo-600" />
        </svg>

        {/* Subtle Ambient Pulse */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
        </span>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-white font-sans">
              Skylark <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-teal-300">Drones</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              BI & Ops AI
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
