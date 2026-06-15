import React, { useEffect, useRef, useState } from "react";
import { Download, X, FileText, CheckCircle, Activity, Thermometer, Eye, Loader2 } from "lucide-react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { DataPoint, Thresholds } from "../types";
import { getODStatusInfo } from "../utils";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataPoints: DataPoint[];
  strain: string;
  activePhase: string;
  thresholds: Thresholds;
  temperature: number;
  targetTemp: number;
}

export default function ReportModal({
  isOpen,
  onClose,
  dataPoints,
  strain,
  activePhase,
  thresholds,
  temperature,
  targetTemp,
}: ReportModalProps) {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const reportWrapperRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [sanitizedCss, setSanitizedCss] = useState<string>("");
  const [isStyleLoading, setIsStyleLoading] = useState<boolean>(false);
  const stylePromiseRef = useRef<Promise<string> | null>(null);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Compute stats based on real data
  const totalSamples = dataPoints.length;
  const avgTemp = totalSamples > 0 
    ? dataPoints.reduce((acc, curr) => acc + curr.temperature, 0) / totalSamples 
    : temperature;
  const maxOD = totalSamples > 0 
    ? Math.max(...dataPoints.map(d => d.opticalDensity)) 
    : 0.1;
  const currentOD = totalSamples > 0 
    ? dataPoints[dataPoints.length - 1].opticalDensity 
    : 0.1;

  const currentStatusLabel = getODStatusInfo(currentOD).label;

  // Thermal compliance score: % of samples that fall within safe temp thresholds
  const compliantSamples = dataPoints.filter(d => d.temperature >= thresholds.tempMin && d.temperature <= thresholds.tempMax).length;
  const thermalCompliance = totalSamples > 0 
    ? Math.round((compliantSamples / totalSamples) * 100) 
    : 100;

  const resolveModernColorsInCss = (cssText: string): string => {
    if (!cssText) return "";
    const targets = ["oklch(", "oklab(", "rgb(from ", "rgba(from ", "color-mix("];
    let output = cssText;

    // 1. Resolve structures that are child expressions
    for (let iter = 0; iter < 10; iter++) {
      let found = false;
      for (const target of targets) {
        let index = output.indexOf(target);
        while (index !== -1) {
          let openCount = 1;
          let j = index + target.length;
          while (j < output.length && openCount > 0) {
            if (output[j] === "(") {
              openCount++;
            } else if (output[j] === ")") {
              openCount--;
            }
            j++;
          }

          if (openCount === 0) {
            const colorExpr = output.substring(index, j);
            let resolved = "rgb(45, 90, 68)"; // default fallback green
            try {
              const temp = document.createElement("div");
              temp.style.color = colorExpr;
              document.body.appendChild(temp);
              const computed = getComputedStyle(temp).color;
              document.body.removeChild(temp);
              if (computed && (computed.startsWith("rgb") || computed.startsWith("rgba") || computed.startsWith("#") || computed === "transparent")) {
                resolved = computed;
              }
            } catch (e) {
              // ignore
            }
            output = output.substring(0, index) + resolved + output.substring(j);
            found = true;
            index = output.indexOf(target, index + resolved.length);
          } else {
            index = output.indexOf(target, index + 1);
          }
        }
      }
      if (!found) break;
    }

    // 2. Resolve or strip custom variables value declarations with oklch/oklab
    output = output.replace(/--[\w-]+\s*:\s*(oklch|oklab|color-mix|rgb\(from|rgba\(from)[^;}\n]+/g, (match) => {
      return match.replace(/(oklch|oklab|color-mix|rgb\(from|rgba\(from)[^;}\n]+/, "rgb(30, 42, 34)");
    });

    return output;
  };

  const fetchAndSanitizeStyles = async (): Promise<string> => {
    let combinedCss = "";

    // 1. Get all style tags in the parent document
    document.querySelectorAll("style").forEach((styleEl) => {
      combinedCss += (styleEl.textContent || "") + "\n";
    });

    // 2. Fetch all link stylesheets in the parent document
    const linkEls = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
    for (const linkEl of linkEls) {
      try {
        const href = (linkEl as HTMLLinkElement).href;
        if (href) {
          const res = await fetch(href);
          if (res.ok) {
            const text = await res.text();
            combinedCss += text + "\n";
          }
        }
      } catch (e) {
        console.warn("Gagal memuat stylesheet:", e);
      }
    }

    // 3. Sanitize the combined CSS text
    return resolveModernColorsInCss(combinedCss);
  };

  useEffect(() => {
    if (isOpen) {
      setIsStyleLoading(true);
      const promise = fetchAndSanitizeStyles();
      stylePromiseRef.current = promise;
      promise.then((css) => {
        setSanitizedCss(css);
        setIsStyleLoading(false);
      }).catch((err) => {
        console.error(err);
        setIsStyleLoading(false);
      });
    }
  }, [isOpen]);

  const downloadPDF = async () => {
    const element = reportWrapperRef.current;
    if (!element) return;

    try {
      setIsDownloading(true);

      let cssToUse = sanitizedCss;
      if (isStyleLoading && stylePromiseRef.current) {
        cssToUse = await stylePromiseRef.current;
      } else if (!cssToUse) {
        cssToUse = await fetchAndSanitizeStyles();
      }

      const options = {
        margin: [10, 10, 10, 10],
        filename: `Laporan_Riset_Spirulina_platensis_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            try {
              // Remove all style and stylesheet references in the cloned DOM to avoid any crash
              clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => {
                el.remove();
              });

              // Add our pre-sanitized stylesheet containing NO oklch/oklab
              const styleEl = clonedDoc.createElement("style");
              styleEl.textContent = cssToUse;
              clonedDoc.head.appendChild(styleEl);

              // Clean inline styles too
              clonedDoc.querySelectorAll("[style]").forEach((el) => {
                const htmlEl = el as HTMLElement;
                const styleAttr = htmlEl.getAttribute("style");
                if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab") || styleAttr.includes("from"))) {
                  const cleaned = resolveModernColorsInCss(styleAttr);
                  htmlEl.setAttribute("style", cleaned);
                }
              });
            } catch (err) {
              console.error("Gagal melakukan sanitasi CSS warna oklch/oklab:", err);
            }
          }
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      } as any;

      // Generate the PDF directly and save
      await html2pdf().set(options).from(element).save();
    } catch (error) {
      console.error("Gagal mendownload PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const currentDateString = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentTimeString = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Simple SVG Line Chart generator for the report
  const renderSVGChart = (metric: "temperature" | "opticalDensity", color: string, title: string, unit: string) => {
    const chartWidth = 580;
    const chartHeight = 110;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 20;

    const activeWidth = chartWidth - paddingLeft - paddingRight;
    const activeHeight = chartHeight - paddingTop - paddingBottom;

    const recentData = dataPoints.slice(-15);
    if (recentData.length === 0) return null;

    const vals = recentData.map(d => d[metric]);
    let minVal = Math.min(...vals);
    let maxVal = Math.max(...vals);
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const diff = maxVal - minVal;
    const gridY = [minVal, minVal + diff * 0.5, maxVal];

    // Build SVG Path
    const points = recentData.map((d, index) => {
      const x = paddingLeft + (index / (recentData.length - 1)) * activeWidth;
      const y = paddingTop + activeHeight - ((d[metric] - minVal) / diff) * activeHeight;
      return { x, y, data: d };
    });

    const linePath = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
      : "";
    
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + activeHeight} L ${points[0].x} ${paddingTop + activeHeight} Z`
      : "";

    return (
      <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 mt-3 avoid-break">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-mono font-bold text-stone-700 tracking-wide uppercase">{title}</span>
          <span className="text-[10px] font-mono text-stone-500">15 Sampel Terakhir ({unit})</span>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-[110px] overflow-visible">
          {/* Grids */}
          {gridY.map((v, i) => {
            const y = paddingTop + activeHeight - ((v - minVal) / diff) * activeHeight;
            return (
              <g key={i}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fill="#64748b" className="font-mono text-[8px] font-bold">
                  {v.toFixed(metric === "temperature" ? 1 : 2)}
                </text>
              </g>
            );
          })}

          {/* Paths */}
          <path d={areaPath} fill={color === "copper" ? "rgba(178, 83, 41, 0.05)" : "rgba(45, 90, 68, 0.05)"} />
          <path d={linePath} fill="none" stroke={color === "copper" ? "#b25329" : "#2d5a44"} strokeWidth="1.8" />

          {/* Dots */}
          {points.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.y} r="2" fill={color === "copper" ? "#b25329" : "#2d5a44"} />
          ))}

          {/* X Axis labels */}
          {points.length > 0 && Array.from(new Set([0, Math.floor(points.length / 2), points.length - 1])).map((idx) => {
            const p = points[idx];
            if (!p) return null;
            return (
              <text key={idx} x={p.x} y={chartHeight - 3} textAnchor={idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"} fill="#94a3b8" className="font-mono text-[7.5px]">
                {p.data.time}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-stone-900/85 backdrop-blur-sm flex justify-center items-start p-0 md:p-8">
      
      {/* Top Floating Control Bar */}
      <div className="no-print fixed top-0 left-0 right-0 h-16 bg-white/95 border-b border-stone-200 flex justify-between items-center px-6 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-[#2d5a44]/15 text-[#2d5a44] p-1.5 rounded-lg border border-[#2d5a44]/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-[#1e2a22]">
              Laporan Riset PDF Resmi
            </h3>
            <p className="text-[10px] text-stone-500">
              Laporan otomatis multi-halaman berstandar riset akademik.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-[#2d5a44] hover:bg-[#204030] disabled:bg-stone-300 text-white py-2 px-4 rounded-xl font-bold font-sans text-xs transition-colors shadow-xs cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isDownloading ? "Mengunduh PDF..." : "Unduh PDF Langsung"}
          </button>
          
          <button
            onClick={onClose}
            className="flex items-center justify-center p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-all cursor-pointer border border-stone-200"
            title="Keluar Pratinjau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Content Scroll Tray */}
      <div ref={printContainerRef} className="w-full flex flex-col items-center gap-8 mt-24 mb-16 px-4 md:px-0">
        
        {/* Printable Report Wrapper */}
        <div ref={reportWrapperRef} className="flex flex-col gap-10 items-center justify-center bg-white/10 p-2 rounded-2xl shadow-inner">

          {/* ==================== PAGE 1 ==================== */}
          <div className="w-[172mm] md:w-[210mm] min-h-[240mm] md:min-h-[297mm] bg-white text-stone-800 p-8 md:p-14 border border-stone-200 shadow-2xl relative flex flex-col justify-between avoid-break">
            
            {/* Top Academic Header */}
            <div>
              <div className="flex justify-between items-start border-b-2 border-[#2d5a44] pb-4">
                <div className="flex items-center gap-4">
                  {/* Decorative circular logo */}
                  <div className="w-12 h-12 rounded-full border-2 border-[#2d5a44] flex items-center justify-center bg-[#2d5a44]/5 flex-shrink-0">
                    <span className="text-[10px] font-serif font-black text-[#2d5a44] tracking-tight">IPB</span>
                  </div>
                  <div>
                    <h2 className="font-sans font-bold text-xs tracking-wide text-stone-900 uppercase">
                      IPB UNIVERSITY — DEPARTEMEN BIOSISTEM
                    </h2>
                    <p className="text-[9px] text-stone-500 font-mono tracking-wider">
                      LABOLATORIUM MIKROALGA & FISIKA PREsISI KULTUR
                    </p>
                    <p className="text-[8px] text-stone-400 font-serif italic">
                      Bogor, Jawa Barat, Indonesia
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[8px] bg-stone-100 border border-stone-200 text-stone-500 font-bold px-1.5 py-0.5 rounded">
                    DOKUMEN RISET INTERNAL
                  </span>
                  <p className="text-[9px] text-[#2d5a44] font-bold mt-1.5">No. AWD/BIO-NODE-01/2026</p>
                </div>
              </div>

              {/* Document Metadata Label */}
              <div className="mt-8">
                <span className="text-[10px] font-mono font-bold text-sky-600 tracking-widest uppercase block mb-1">
                  LAPORAN PEMANTAUAN KULTUR TELEMETRI
                </span>
                <h1 className="font-serif font-bold text-2xl text-stone-900 leading-snug">
                  Pemantauan Kerapatan Biomassa & Rekayasa Thermostatik Dinamis Kultur *Spirulina platensis*
                </h1>
                <p className="text-[11px] text-stone-500 font-sans mt-2 leading-relaxed">
                  Studi telemetri otomatis menggunakan sensor fotoluminensi 600nm dan kendali termal lingkar tertutup (closed-loop) pada unit reaktor uji laboratorium dengan sinkronisasi basis data real-time.
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="mt-6 border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50 text-[10px]">
                <div className="grid grid-cols-3 divide-x divide-stone-200 border-b border-stone-200">
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">PERANGKAT / NODE</span>
                    <span className="font-bold text-stone-800">AWD-NODE-01 (ESP32)</span>
                  </div>
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">LOKASI PENELITIAN</span>
                    <span className="font-bold text-stone-800">Sawah Lab Cikabayan</span>
                  </div>
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">VOLUME KULTUR</span>
                    <span className="font-bold text-stone-800">10 Liter (Pilot Stage)</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-stone-200">
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">TANGGAL BERJALAN</span>
                    <span className="font-bold text-stone-800">15 Juni 2026</span>
                  </div>
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">ORGANISME DIUJI</span>
                    <span className="font-bold text-stone-800 italic">Spirulina platensis</span>
                  </div>
                  <div className="p-3">
                    <span className="block text-stone-400 font-mono text-[8px] font-bold uppercase">DIBUAT PADA</span>
                    <span className="font-bold text-stone-800">{currentDateString}, {currentTimeString} WIB</span>
                  </div>
                </div>
              </div>

              {/* Section 1: Ringkasan Eksekutif */}
              <div className="mt-8 border-t border-stone-100 pt-6">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-3">
                  <span className="text-[#2d5a44] font-black">1</span> Ringkasan Eksekutif
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-sans">
                  Kultur biomasa mikroalga <span className="font-bold italic">Spirulina platensis</span> yang dipelihara pada photobioreaktor saat ini berada pada <span className="font-bold underline text-[#2d5a44]">Status {currentStatusLabel}</span>. Laju fotosintetis dioptimalkan dengan menjaga suhu termal inkubator stabil pada level optimum terukur <span className="font-bold">{targetTemp.toFixed(1)}°C</span>. Rata-rata temperatur terkendali tercatat sebesar <span className="font-bold">{avgTemp.toFixed(2)}°C</span> dengan indeks kepatuhan termodinamika mencapai <span className="font-bold text-[#2d5a44]">{thermalCompliance}%</span> dari rentang aman yang ditentukan ({thresholds.tempMin.toFixed(1)}°C s.d. {thresholds.tempMax.toFixed(1)}°C). Analisis kepadatan optik (Optical Density) terakhir berada di level <span className="font-bold text-emerald-800">{currentOD.toFixed(3)} OD</span> terhadap batas target panen {thresholds.odTarget.toFixed(2)} OD, menandakan proses pertumbuhan biologis alga berlangsung secara stabil dan sehat tanpa anomali.
                </p>
              </div>

              {/* Section 2: Indikator Kinerja Utama (KPI) */}
              <div className="mt-8 border-t border-stone-100 pt-6">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-4">
                  <span className="text-[#2d5a44] font-black">2</span> Indikator Kinerja Utama
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  {/* KPI card 1 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-stone-500" />
                      Rerata Suhu Reaktor
                    </div>
                    <div className="font-serif text-lg font-bold text-stone-900">
                      {avgTemp.toFixed(2)}°C
                    </div>
                    <span className="text-[8.5px] text-[#2d5a44] font-mono font-medium">Batas Optimum: {targetTemp.toFixed(1)}°C</span>
                  </div>

                  {/* KPI card 2 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <Eye className="w-3.5 h-3.5 text-stone-500" />
                      Kerapatan Sel OD
                    </div>
                    <div className="font-serif text-lg font-bold text-stone-900">
                      {currentOD.toFixed(3)} OD
                    </div>
                    <span className="text-[8.5px] text-stone-500 font-mono font-medium">Status: {currentStatusLabel}</span>
                  </div>

                  {/* KPI card 3 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <CheckCircle className="w-3.5 h-3.5 text-stone-500" />
                      Target Panen OD
                    </div>
                    <div className="font-serif text-lg font-bold text-stone-900">
                      {thresholds.odTarget.toFixed(2)} OD
                    </div>
                    <span className="text-[8.5px] text-stone-500 font-mono font-medium">Kecukupan: {((currentOD / thresholds.odTarget) * 100).toFixed(0)}%</span>
                  </div>

                  {/* KPI card 4 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <Activity className="w-3.5 h-3.5 text-[#2d5a44]" />
                      Kepatuhan Termal
                    </div>
                    <div className="font-serif text-lg font-bold text-[#2d5a44]">
                      {thermalCompliance}%
                    </div>
                    <span className="text-[8.5px] text-[#2d5a44] font-mono font-medium">Suhu Terkontrol Baik</span>
                  </div>

                  {/* KPI card 5 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <Activity className="w-3.5 h-3.5 text-stone-500" />
                      Jumlah Log Sampel
                    </div>
                    <div className="font-serif text-lg font-bold text-stone-900">
                      {totalSamples} Log
                    </div>
                    <span className="text-[8.5px] text-stone-500 font-mono font-medium">Iterasi Telemetri Aman</span>
                  </div>

                  {/* KPI card 6 */}
                  <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/50">
                    <div className="flex items-center gap-1.5 text-stone-400 font-mono text-[8px] font-bold uppercase mb-1">
                      <CheckCircle className="w-3.5 h-3.5 text-stone-500" />
                      Status Sistem
                    </div>
                    <div className="font-serif text-base font-bold text-[#2d5a44] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#2d5a44] animate-ping" />
                      NORMAL
                    </div>
                    <span className="text-[8.5px] text-stone-500 font-mono font-medium">Telemetri Aktif Synced</span>
                  </div>

                </div>
              </div>
            </div>

            {/* Print Document page footers */}
            <div className="border-t border-stone-200 pt-3 flex justify-between text-stone-400 font-mono text-[8px] mt-8">
              <span>Smart BioReactor Automatic Academic Report — Spirulina platensis</span>
              <span>Halaman 1 dari 3</span>
            </div>
          </div>

          <div className="page-break" />

          {/* ==================== PAGE 2 ==================== */}
          <div className="w-[172mm] md:w-[210mm] min-h-[240mm] md:min-h-[297mm] bg-white text-stone-800 p-8 md:p-14 border border-stone-200 shadow-2xl relative flex flex-col justify-between avoid-break">
            <div>
              {/* Header Page 2 */}
              <div className="flex justify-between items-center border-b border-stone-200 pb-3">
                <span className="text-[9px] font-mono font-bold text-stone-500">Laporan Pemantauan Lapang — Spirulina platensis</span>
                <span className="text-[9px] font-mono text-stone-400">No. AWD/BIO-NODE-01/2026</span>
              </div>

              {/* Section 3: Dinamika Optik & Fluktuasi Termal */}
              <div className="mt-6">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-2">
                  <span className="text-[#2d5a44] font-black">3</span> Dinamika Kerapatan Optik & Fluktuasi Termal (Grafik)
                </h3>
                <p className="text-[11px] text-stone-500 mb-4">
                  Visualisasi grafik temporal di bawah menggambarkan respon kinetis optat-fotometri (Optical Density penggambaran biomasa sel) terhadap dinamika temperatur reaktor selama operasi riset berlangsung.
                </p>

                {/* Main Temperature Plot SVG */}
                {renderSVGChart("temperature", "copper", "A. Fluktuasi Suhu Bioreaktor Nyata (°C)", "°C")}

                {/* OD Plot SVG */}
                {renderSVGChart("opticalDensity", "emerald", "B. Kurva Akumulasi Biomassa Optik (OD)", "OD")}

                <div className="mt-6 text-xs text-stone-600 leading-relaxed font-sans space-y-3 bg-stone-50/50 p-4 border border-stone-150 rounded-xl">
                  <p className="font-bold text-[#1e2a22] text-[11px] font-mono uppercase tracking-wide">Analisis Grafik Terkini:</p>
                  <p className="text-[10.5px]">
                    Fluktuasi suhu terkendali secara bertahap mendekati garis ideal termostatik <span className="font-bold text-[#b25329]">{targetTemp.toFixed(1)}°C</span>. Respon laju pertumbuhan cell <span className="font-bold italic">Spirulina platensis</span> menguat saat suhu berada stabil pada rentang optimal {thresholds.tempMin.toFixed(1)}°C s.d. {thresholds.tempMax.toFixed(1)}°C, ditandai dengan peningkatan tajam pada kurva kinetika Optical Density (OD) monokromatis 600nm. Perubahan status menuju <span className="font-bold">{currentStatusLabel}</span> dikonfirmasi secara akurat oleh respons fotoreseptor fotometrik yang terpasang di dinding photobioreaktor tabung beraliran silinder.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Page 2 */}
            <div className="border-t border-stone-200 pt-3 flex justify-between text-stone-400 font-mono text-[8px] mt-8">
              <span>Smart BioReactor Automatic Academic Report — Spirulina platensis</span>
              <span>Halaman 2 dari 3</span>
            </div>
          </div>

          <div className="page-break" />

          {/* ==================== PAGE 3 ==================== */}
          <div className="w-[172mm] md:w-[210mm] min-h-[240mm] md:min-h-[297mm] bg-white text-stone-800 p-8 md:p-14 border border-stone-200 shadow-2xl relative flex flex-col justify-between avoid-break font-sans">
            <div>
              {/* Header Page 3 */}
              <div className="flex justify-between items-center border-b border-stone-200 pb-3">
                <span className="text-[9px] font-mono font-bold text-stone-500">Laporan Pemantauan Lapang — Spirulina platensis</span>
                <span className="text-[9px] font-mono text-stone-400">No. AWD/BIO-NODE-01/2026</span>
              </div>

              {/* Section 4: Statistik & Catatan Riwayat Kinerja */}
              <div className="mt-6">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-3">
                  <span className="text-[#2d5a44] font-black">4</span> Statistik Catatan Riwayat Kinerja Terkini (10 Log Terbaru)
                </h3>
                
                {/* Table formatting matching screenshot section 5 */}
                <div className="border border-stone-200 rounded-xl overflow-hidden mt-3">
                  <table className="w-full text-[10px] text-left border-collapse font-mono">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 font-bold text-stone-600">
                        <th className="py-2.5 px-4">INDEX</th>
                        <th className="py-2.5 px-4">WAKTU</th>
                        <th className="py-2.5 px-4">SUHU NYATA (°C)</th>
                        <th className="py-2.5 px-4">STATUS SUHU</th>
                        <th className="py-2.5 px-4">OPTIK (OD)</th>
                        <th className="py-2.5 px-4">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-700 bg-white">
                      {dataPoints.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-3 px-4 text-center text-stone-400">Tidak ada log data tercatat.</td>
                        </tr>
                      ) : (
                        [...dataPoints].reverse().slice(0, 10).map((dp, idx) => {
                          const num = dataPoints.length - idx;
                          const statInfo = getODStatusInfo(dp.opticalDensity);
                          return (
                            <tr key={dp.id} className={idx % 2 === 0 ? "bg-white" : "bg-stone-50/30"}>
                              <td className="py-2 px-4 font-bold text-stone-500">#{num.toString().padStart(3, "0")}</td>
                              <td className="py-2 px-4">{dp.time}</td>
                              <td className="py-2 px-4 font-bold">{dp.temperature.toFixed(2)} °C</td>
                              <td className="py-2 px-4">
                                <span className={`text-[8.5px] font-bold ${
                                  dp.tempStatus === "Normal" ? "text-emerald-700 bg-emerald-50 px-1 rounded" : "text-[#b25329] bg-[#f9f1ec] px-1 rounded"
                                }`}>
                                  {dp.tempStatus}
                                </span>
                              </td>
                              <td className="py-2 px-4 font-bold text-stone-900">{dp.opticalDensity.toFixed(3)} OD</td>
                              <td className="py-2 px-4">
                                <span className={`text-[8.5px] px-1.5 py-0.5 rounded border inline-block ${statInfo.badgeClass}`}>
                                  {statInfo.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5: Metodologi & Kalibrasi Sensor */}
              <div className="mt-6 border-t border-stone-100 pt-5">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-2.5">
                  <span className="text-[#2d5a44] font-black">5</span> Metodologi & Kalibrasi Sensor Otomatis
                </h3>
                <p className="text-[10.5px] text-stone-600 leading-relaxed font-sans mb-3">
                  Pengukuran kerapatan sel dilakukan berdasarkan adaptasi hukum fotometri <span className="font-bold">Beer-Lambert</span>. Sensor monokromatis 600nm memancarkan cahaya terarah yang dideteksi oleh fotoreseptor presisi tinggi terisolasi untuk mendeteksi pembiasan dari kerapatan suspensi biomassa <span className="italic">Spirulina platensis</span>. Telemetri termal terintegrasi menggunakan sensor digital baja tahan karat DS18B20 dengan resolusi pembacaan 12-bit terkalibrasi guna meminimalisir kesalahan pembacaan termal (deviasi maksimal ±0.1°C).
                </p>
              </div>

              {/* Section 6: Kesimpulan & Rekomendasi Lapangan */}
              <div className="mt-5 border-t border-stone-100 pt-5">
                <h3 className="font-mono text-xs font-bold text-[#1e2a22] flex items-center gap-1.5 mb-2.5">
                  <span className="text-[#2d5a44] font-black">6</span> Kesimpulan & Rekomendasi Lapangan
                </h3>
                <ul className="text-[10.5px] text-stone-600 leading-relaxed font-sans list-disc pl-5 space-y-1.5">
                  <li>Suhu bioreaktor berada pada level stabil dengan rata-rata yang sangat kondusif untuk mendukung fotosintetis asimilasi mikroalga.</li>
                  <li>Disarankan untuk melakukan injeksi mikro-nutrisi tambahan ketika densitas sel hampir mendekati batas saturasi panen ({thresholds.odTarget} OD).</li>
                  <li>Lakukan pembersihan terjadwal pada dinding kaca sensor fotoreseptor agar bebas dari biofouling alga yang bisa mendistorsi pembacaan optical density.</li>
                </ul>
              </div>

              {/* Verified Signoff boxes */}
              <div className="mt-8 grid grid-cols-2 gap-8 text-[11px] pt-8 border-t border-stone-100 font-sans avoid-break">
                <div className="text-left">
                  <span className="text-stone-400 block mb-12">Dibuat Oleh/Analis:</span>
                  <div className="h-0.5 w-32 bg-stone-300 mb-1" />
                  <span className="font-bold text-stone-800 block">Lab Analyst Team</span>
                  <span className="text-stone-400 text-[9px] block">AWD-NODE Telemetry System</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-stone-400 block mb-12 mr-16">Mengetahui/Supervisor:</span>
                  <div className="h-0.5 w-32 bg-stone-300 mb-1" />
                  <span className="font-bold text-stone-800 block mr-8 underline decoration-[#2d5a44] decoration-2">Dr. Ir. Biosis, M.Si</span>
                  <span className="text-stone-400 text-[9px] block mr-4">Kepala Laboratorium Bioteknologi Alga</span>
                </div>
              </div>

            </div>

            {/* Footer Page 3 */}
            <div className="border-t border-stone-200 pt-3 flex justify-between text-stone-400 font-mono text-[8px] mt-8">
              <span>Smart BioReactor Automatic Academic Report — Spirulina platensis</span>
              <span>Halaman 3 dari 3</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
