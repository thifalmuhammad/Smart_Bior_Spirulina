import React, { useState, useRef, useEffect } from "react";
import { DataPoint } from "../types";

interface ChartProps {
  data: DataPoint[];
  title: string;
  color: "copper" | "emerald";
  unit: string;
  metric: "temperature" | "opticalDensity";
  minVal: number;
  maxVal: number;
}

export default function BioChart({
  data,
  title,
  color,
  unit,
  metric,
  minVal,
  maxVal,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(220);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Update canvas sizing dynamically using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width || 500);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = Math.max(width - paddingLeft - paddingRight, 50);
  const chartHeight = Math.max(height - paddingTop - paddingBottom, 50);

  // Show all data points as they keep coming
  const activeData = data;

  // Compute scale boundaries
  let dataYMin = Math.min(...activeData.map((d) => d[metric]), minVal);
  let dataYMax = Math.max(...activeData.map((d) => d[metric]), maxVal);

  // Add 15% breathing space
  const diff = dataYMax - dataYMin || 1;
  const yMin = Math.max(0, dataYMin - diff * 0.15);
  const yMax = dataYMax + diff * 0.15;

  // Generate SVG Coordinates
  const points = activeData.map((d, index) => {
    const x =
      paddingLeft +
      (activeData.length > 1
        ? (index / (activeData.length - 1)) * chartWidth
        : chartWidth / 2);
    // Invert Y coordinate for SVG space
    const y =
      paddingTop +
      chartHeight -
      ((d[metric] - yMin) / (yMax - yMin)) * chartHeight;
    return { x, y, data: d, index };
  });

  // SVG path definitions
  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` +
      points
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(" ");

    // Close the area path for elegant background gradient fills
    areaPath =
      `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Handle Mouse Hover tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (points.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - svgRect.left;

    // Find closest index based on X position
    let closestIndex = 0;
    let minDistance = Infinity;

    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - cursorX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setHoverIndex(closestIndex);
    setTooltipPos({
      x: points[closestIndex].x,
      y: points[closestIndex].y - 12,
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Grid line levels
  const gridLinesCount = 4;
  const gridLineValues = Array.from({ length: gridLinesCount }, (_, i) => {
    return yMin + (i * (yMax - yMin)) / (gridLinesCount - 1);
  });

  // Gradient IDs based on color chosen
  const primaryGradient = `${metric}-gradient`;
  const areaGradient = `${metric}-area-gradient`;

  const themeColors = {
    copper: {
      line: "#b25329",
      areaStop: "rgba(178, 83, 41, 0.08)",
      badge: "border-[#f0ded4] text-[#b25329] bg-[#f9f1ec]",
    },
    emerald: {
      line: "#2d5a44",
      areaStop: "rgba(45, 90, 68, 0.08)",
      badge: "border-[#d2ddd6] text-[#2d5a44] bg-[#e8ece9]",
    },
  }[color];

  return (
    <div
      ref={containerRef}
      className="p-6 bg-white border border-stone-200 rounded-2xl relative shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-stone-300/80"
    >
      {/* Chart Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="font-display font-medium text-sm text-[#1e2a22] tracking-wide">
            {title}
          </h4>
          <p className="text-xs text-stone-400 font-mono">
            {activeData.length} sampel terakhir
          </p>
        </div>
        <div className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${themeColors.badge}`}>
          {activeData.length > 0
            ? `${activeData[activeData.length - 1][metric].toFixed(2)} ${unit}`
            : "--"}
        </div>
      </div>

      {activeData.length === 0 ? (
        <div className="h-[220px] flex flex-col justify-center items-center text-stone-400 text-xs border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
          <span className="animate-pulse text-lg mb-1">⏳</span>
          <span>Menunggu sinyal data dari bioreaktor...</span>
        </div>
      ) : (
        <div className="relative">
          <svg
            width={width}
            height={height}
            className="overflow-visible cursor-crosshair touch-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id={primaryGradient} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={themeColors.line} />
                <stop offset="100%" stopColor={themeColors.line} />
              </linearGradient>
              <linearGradient id={areaGradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={themeColors.line} stopOpacity={0.15} />
                <stop offset="100%" stopColor={themeColors.line} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {gridLineValues.map((v, i) => {
              const yVal =
                paddingTop +
                chartHeight -
                ((v - yMin) / (yMax - yMin)) * chartHeight;
              return (
                <g key={i} className="opacity-100">
                  <line
                    x1={paddingLeft}
                    y1={yVal}
                    x2={width - paddingRight}
                    y2={yVal}
                    stroke="#eae8e1"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={yVal + 4}
                    fill="#78716c"
                    textAnchor="end"
                    className="font-mono text-[9px] font-medium"
                  >
                    {v.toFixed(metric === "temperature" ? 1 : 2)}
                  </text>
                </g>
              );
            })}

            {/* Area Path */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#${areaGradient})`}
                className="transition-all duration-300"
              />
            )}

            {/* Line Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={`url(#${primaryGradient})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )}

            {/* Data Dots */}
            {points.map((p, idx) => {
              const isHovered = hoverIndex === idx;
              return (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : 2}
                  fill={isHovered ? "#ffffff" : themeColors.line}
                  stroke={themeColors.line}
                  strokeWidth={isHovered ? 2.5 : 0}
                  className="transition-all duration-150"
                />
              );
            })}

            {/* Crosshair Guide Line on Hover */}
            {hoverIndex !== null && points[hoverIndex] && (
              <line
                x1={points[hoverIndex].x}
                y1={paddingTop}
                x2={points[hoverIndex].x}
                y2={paddingTop + chartHeight}
                stroke="#a8a29e"
                strokeWidth="1"
                strokeDasharray="2 2"
                pointerEvents="none"
              />
            )}

            {/* X-Axis ticks */}
            {points.length > 0 &&
              Array.from(new Set([0, Math.floor(points.length / 2), points.length - 1])).map(
                (idx) => {
                  const p = points[idx];
                  if (!p) return null;
                  return (
                    <text
                      key={idx}
                      x={p.x}
                      y={paddingTop + chartHeight + 18}
                      fill="#78716c"
                      textAnchor={
                        idx === 0
                          ? "start"
                          : idx === points.length - 1
                          ? "end"
                          : "middle"
                      }
                      className="font-mono text-[9px]"
                    >
                      {p.data.time}
                    </text>
                  );
                }
              )}
          </svg>

          {/* Interactive Tooltip Overlay */}
          {hoverIndex !== null && points[hoverIndex] && (
            <div
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full flex flex-col items-center z-20 transition-all duration-75"
            >
              <div className="bg-white border border-stone-200 py-1.5 px-2.5 rounded-lg shadow-lg text-[10px] text-stone-800 whitespace-nowrap font-mono flex flex-col gap-0.5">
                <span className="text-stone-400 text-[9px]">
                  {points[hoverIndex].data.time}
                </span>
                <span className="font-bold text-[#1e2a22]">
                  {points[hoverIndex].data[metric].toFixed(2)}{" "}
                  <span className="text-stone-500 font-normal">{unit}</span>
                </span>
                <span
                  className={`text-[8px] font-semibold uppercase ${
                    metric === "temperature"
                      ? points[hoverIndex].data.tempStatus === "Normal"
                        ? "text-[#2d5a44]"
                        : "text-[#b25329]"
                      : "text-[#2d5a44]"
                  }`}
                >
                  {metric === "temperature"
                    ? points[hoverIndex].data.tempStatus
                    : points[hoverIndex].data.phase}
                </span>
              </div>
              <div className="w-1.5 h-1.5 bg-white border-r border-b border-stone-200 transform rotate-45 -mt-1" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

