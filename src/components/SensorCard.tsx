import { LucideIcon } from "lucide-react";

interface SensorCardProps {
  title: string;
  subTitle: string;
  value: number | string;
  unit: string;
  statusText: string;
  statusType: "success" | "warning" | "error" | "info";
  rangeText: string;
  icon: LucideIcon;
  channel: string;
  unitFormat?: string;
}

export default function SensorCard({
  title,
  subTitle,
  value,
  unit,
  statusText,
  statusType,
  rangeText,
  icon: Icon,
  channel,
}: SensorCardProps) {
  // Map our dynamic status theme to the beautiful, rich colors of the landing page:
  // - Forest / Emerald Green (#2d5a44)
  // - Warm Terracotta (#b25329)
  // - Amber (#d97706)
  // - Soft Sage / Slate
  const colors = {
    success: {
      border: "border-stone-200 hover:border-emerald-800/20",
      accent: "bg-[#2d5a44]",
      badge: "bg-[#e8ece9] text-[#2d5a44] border-[#d2ddd6]",
    },
    warning: {
      border: "border-stone-200 hover:border-amber-500/20",
      accent: "bg-amber-600",
      badge: "bg-amber-50/70 text-amber-800 border-amber-200/60",
    },
    error: {
      border: "border-stone-200 hover:border-rose-500/20",
      accent: "bg-[#b25329]",
      badge: "bg-[#f9f1ec] text-[#b25329] border-[#f0ded4]",
    },
    info: {
      border: "border-stone-200 hover:border-sky-500/20",
      accent: "bg-sky-600",
      badge: "bg-sky-50 text-sky-800 border-sky-200/65",
    },
  }[statusType];

  return (
    <div
      className={`relative overflow-hidden bg-white border ${colors.border} rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-stone-100/80`}
    >
      {/* Decorative vertical forest green or terracotta status bar */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colors.accent}`} />

      {/* Header Info */}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl border border-stone-100 bg-stone-50/50 text-stone-600">
            <Icon className="w-5 h-5 text-stone-500" />
          </div>
          <div>
            <span className="text-[9px] font-mono font-bold tracking-widest text-stone-400 block uppercase">
              {channel}
            </span>
            <h3 className="font-display font-medium text-base text-[#1e2a22] flex items-center gap-1.5 leading-tight">
              {title}
            </h3>
            <span className="text-xs text-stone-500 font-sans block mt-0.5">
              {subTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Value & Unit block */}
      <div className="mt-6 flex items-baseline gap-2 relative z-10">
        <span className="font-display font-bold text-5xl tracking-tight text-[#1e2a22] select-all">
          {typeof value === "number" ? value.toFixed(2) : value}
        </span>
        <span className="text-sm font-medium text-stone-500 font-display">
          {unit === "OD600" ? "OD" : unit}
        </span>
      </div>

      {/* Footer Info / Status Alert */}
      <div className="mt-6 pt-4 border-t border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10 text-xs font-mono">
        <div className="flex items-center gap-2">
          {/* Glowing dot */}
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colors.accent}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${colors.accent}`} />
          </span>
          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${colors.badge}`}>
            {statusText}
          </span>
        </div>
        <div className="text-stone-500 text-[10px] bg-stone-50 px-2 py-0.5 rounded border border-stone-100">
          Range: {rangeText}
        </div>
      </div>
    </div>
  );
}

