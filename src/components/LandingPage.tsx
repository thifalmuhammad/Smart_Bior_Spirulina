import { motion } from "motion/react";
import {
  ArrowRight,
  Activity,
  Thermometer,
  Eye,
  ShieldAlert,
  Cpu,
  Download,
  Database,
  Leaf,
} from "lucide-react";
import { getODStatusInfo } from "../utils";

interface LandingPageProps {
  onEnterDashboard: () => void;
  currentTemp: number;
  currentOD: number;
  isSimulating: boolean;
}

export default function LandingPage({
  onEnterDashboard,
  currentTemp,
  currentOD,
  isSimulating,
}: LandingPageProps) {
  const odStatus = getODStatusInfo(currentOD);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#292524] font-sans selection:bg-[#2d5a44]/20 selection:text-[#2d5a44] overflow-x-hidden">
      {/* Decorative background grid and ambient glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />
      
      {/* Ambient decorative green blur */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-[#2d5a44]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header / Navbar */}
      <nav className="relative z-50 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-stone-200/60 bg-[#faf9f6]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#2d5a44]/10 text-[#2d5a44] rounded-xl border border-[#2d5a44]/15">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif font-semibold text-lg text-[#1e2a22] tracking-tight block">
              Smart BioReactor
            </span>
            <span className="text-[9px] font-mono font-bold text-stone-400 tracking-wider uppercase block">
              Algae Telemetry System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onEnterDashboard}
            className="group flex items-center gap-1.5 px-4 py-2 bg-[#2d5a44] hover:bg-[#204030] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            Buka Dashboard
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative max-w-7xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Side Content */}
        <div className="lg:col-span-7 space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-[#2d5a44] border border-emerald-100 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            ESP32 + Firebase RealTime Integration
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#1e2a22] font-semibold tracking-tight leading-[1.1]">
            Automated Monitoring <br />
            Untuk Kultivasi <br />
            <span className="italic text-[#2d5a44] font-medium underline decoration-emerald-200 decoration-wavy underline-offset-8">
              Spirulina platensis
            </span>
          </h1>

          <p className="text-stone-600 max-w-xl text-sm sm:text-base leading-relaxed">
            Sistem pengawasan cerdas fotobioreaktor beraliran terkontrol menggunakan
            telemetri fotometrik instan. Mengukur pertumbuhan massa biologis alga secara real-time
            guna memastikan produktivitas biomassa yang optimal.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={onEnterDashboard}
              className="group flex items-center gap-2 px-6 py-3.5 bg-[#2d5a44] hover:bg-[#204030] text-stone-50 font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              Mulai Pemantauan Real-Time
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Right Side - Interactive Real-Time Quick Stats Widget */}
        <div className="lg:col-span-5 relative">
          <div className="absolute inset-x-0 -top-12 -bottom-12 bg-emerald-900/5 rounded-3xl blur-2xl pointer-events-none" />
          
          {/* Main Hero Card simulating active bioreactor telemetry */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative bg-white border border-stone-200 shadow-xl rounded-3xl p-6 space-y-6"
          >
            <div className="flex justify-between items-center border-b border-stone-100 pb-4">
              <div>
                <span className="text-[10px] font-mono text-stone-400 font-bold block uppercase tracking-wider">
                  Live Feed Status
                </span>
                <span className="font-serif font-medium text-sm text-[#1e2a22]">
                  Parameter Bioreaktor Aktif
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#e8ece9] text-[#2d5a44] px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold border border-[#d2ddd6]">
                <span className={`w-1.5 h-1.5 rounded-full ${isSimulating ? "bg-[#2d5a44] animate-pulse" : "bg-stone-400"}`} />
                {isSimulating ? "SIMULATING" : "STANDBY"}
              </div>
            </div>

            {/* Quick Metrics display */}
            <div className="grid grid-cols-2 gap-4">
              {/* Temperature */}
              <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-100 relative overflow-hidden group hover:border-[#2d5a44]/20 transition-colors">
                <div className="text-stone-400 absolute right-3 top-3">
                  <Thermometer className="w-5 h-5 text-orange-500/80" />
                </div>
                <span className="text-[9px] font-mono text-stone-400 font-bold block uppercase tracking-wider">
                  Suhu Reaktor
                </span>
                <span className="font-display font-bold text-2xl text-stone-800 tracking-tight block mt-1.5">
                  {currentTemp.toFixed(2)} <span className="text-xs font-normal">°C</span>
                </span>
                <span className="inline-block mt-2 bg-emerald-50 text-emerald-700 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-100">
                  OPTIMUM 35°C
                </span>
              </div>

              {/* Optical Density */}
              <div className="bg-stone-50/50 p-4 rounded-2xl border border-stone-100 relative overflow-hidden group hover:border-[#2d5a44]/20 transition-colors">
                <div className="text-stone-400 absolute right-3 top-3">
                  <Eye className="w-5 h-5 text-emerald-600/80" />
                </div>
                <span className="text-[9px] font-mono text-stone-400 font-bold block uppercase tracking-wider">
                  Optical Density
                </span>
                <span className="font-display font-bold text-2xl text-stone-800 tracking-tight block mt-1.5">
                  {currentOD.toFixed(3)} <span className="text-xs font-normal">OD</span>
                </span>
                <span className={`inline-block mt-2 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${odStatus.colorClass} border-current/20`}>
                  {odStatus.label.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Simulated terminal response ticker */}
            <div className="bg-stone-900 rounded-xl p-3 font-mono text-[9px] text-[#2d5a44] space-y-1 block border border-stone-800 select-none shadow-inner">
              <p className="text-stone-400 font-bold mb-1">🔥 LIVE TELEMETRY RESPONSE:</p>
              <p>&gt; Connected: {isSimulating ? "TRUE" : "FALSE"}</p>
              <p>&gt; Temp: {currentTemp.toFixed(2)} °C | Status: NORMAL</p>
              <p>&gt; OD600: {currentOD.toFixed(3)} | Phase: {odStatus.label}</p>
            </div>

            <button
              onClick={onEnterDashboard}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#e8ece9] hover:bg-[#d5ded8] text-[#2d5a44] text-xs font-bold rounded-xl border border-[#d2ddd6] transition-colors cursor-pointer"
            >
              Masuk Dashboard Kendali
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </div>
      </header>

      {/* Feature Bento Grid Section */}
      <section className="bg-white border-y border-stone-200/80 py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-mono font-bold text-[#2d5a44] uppercase tracking-widest block">
              Fitur Sistem Unggulan
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#1e2a22] font-semibold tracking-tight">
              Arsitektur Cerdas Terintegrasi
            </h2>
            <p className="text-stone-500 text-sm">
              Dirancang untuk menjaga stabilitas sirkulasi dan mencatat indeks pertumbuhan tanaman mikroalga secara otomatis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-[#faf9f6]/40 p-6 rounded-2xl border border-stone-200/60 flex flex-col space-y-4 hover:border-[#2d5a44]/30 hover:shadow-xs transition-all">
              <div className="p-3 bg-emerald-50 text-[#2d5a44] rounded-xl self-start">
                <Leaf className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-[#1e2a22] text-base">
                Kultur Spesies Optimum
              </h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Menyediakan preset budidaya optimal untuk mikroalga jenis <span className="italic">Spirulina platensis</span> dengan acuan termostatik adaptif otomatis.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#faf9f6]/40 p-6 rounded-2xl border border-stone-200/60 flex flex-col space-y-4 hover:border-[#2d5a44]/30 hover:shadow-xs transition-all">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl self-start">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-[#1e2a22] text-base">
                Kinetika Pertumbuhan OD
              </h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Membaca absorbansi molekuler sel alga pada panjang gelombang monokromatik 600nm menggunakan hukum beer-lambert yang dikalibrasi instan.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#faf9f6]/40 p-6 rounded-2xl border border-stone-200/60 flex flex-col space-y-4 hover:border-[#2d5a44]/30 hover:shadow-xs transition-all">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl self-start">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-[#1e2a22] text-base">
                Sistem Peringatan Pintar
              </h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Notifikasi otomatis transisi dari Fase Awal, Pertumbuhan Cepat, Siap Panen, hingga peringatan keras saat fase Kultur Kritis terdeteksi.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#faf9f6]/40 p-6 rounded-2xl border border-stone-200/60 flex flex-col space-y-4 hover:border-[#2d5a44]/30 hover:shadow-xs transition-all">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl self-start">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-semibold text-[#1e2a22] text-base">
                Laporan Riset Ekspor PDF
              </h3>
              <p className="text-stone-500 text-xs leading-relaxed">
                Menghasilkan ringkasan dan analisis ekologis kultur lengkap, statistik penyimpangan termal, dan data rekapitulasi numerik siap cetak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box Section */}
      <section className="bg-[#faf9f6] py-16 px-6 relative">
        <div className="max-w-4xl mx-auto bg-stone-50/60 rounded-3xl border border-stone-200/60 p-10 md:p-14 text-center shadow-xs">
          <span className="text-[10px] font-mono font-bold text-[#2d5a44] tracking-widest uppercase block">
            — Mulai Pemantauan
          </span>
          <h2 className="font-serif text-3xl md:text-4xl text-[#1e2a22] font-semibold tracking-tight mt-3">
            Menjaga Kultur Sebelum Terlambat
          </h2>
          <p className="text-stone-500 max-w-xl mx-auto text-xs md:text-sm leading-relaxed mt-4">
            Pantau Optical Density secara real-time, dapatkan peringatan dini
            culture crash, dan kelola budidaya mikroalga tanpa instrumen
            laboratorium yang mahal.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button
              onClick={onEnterDashboard}
              className="px-6 py-3 bg-[#2d5a44] hover:bg-[#204030] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Buka Dashboard
            </button>
            <button
              onClick={() => alert("Dokumentasi Prototipe akan segera tersedia secara lengkap.")}
              className="px-6 py-3 border border-stone-350 hover:bg-stone-100/50 text-stone-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Dokumentasi Prototipe
            </button>
          </div>
        </div>
      </section>

      {/* Beautiful Customized Footer matching mockup */}
      <footer className="border-t border-stone-200/80 bg-[#faf9f6] py-16 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 items-center md:items-start text-stone-500 text-xs">
          
          {/* Logo Column */}
          <div className="md:col-span-5 flex items-center gap-6">
            {/* Custom Large Leaf SVG matching the mock logo perfectly */}
            <svg
              className="w-24 h-24 text-[#2d5a44]"
              viewBox="0 0 100 100"
              fill="currentColor"
            >
              <path
                d="M15,85 C15,85 25,60 55,40 C65,33 75,25 80,15 C65,22 55,30 45,45 C25,75 15,85 15,85 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M15,85 C15,85 35,45 60,35 C75,29 85,20 85,15 C85,25 75,40 60,55 C40,75 15,85 15,85 Z"
              />
              <path
                d="M15,85 Q45,50 85,15"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <span className="font-serif font-bold text-lg text-[#1e2a22] tracking-normal leading-tight block">
                Smart-
              </span>
              <span className="font-serif font-bold text-lg text-[#1e2a22] tracking-normal leading-tight block">
                Bior
              </span>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-3 space-y-3.5">
            <h4 className="text-[10px] font-mono font-bold tracking-wider text-stone-500 uppercase block">
              Navigasi
            </h4>
            <ul className="space-y-2 text-stone-400">
              <li>
                <button onClick={onEnterDashboard} className="hover:text-[#2d5a44] transition-colors cursor-pointer text-left">
                  Solusi
                </button>
              </li>
              <li>
                <button onClick={onEnterDashboard} className="hover:text-[#2d5a44] transition-colors cursor-pointer text-left">
                  Fitur Utama
                </button>
              </li>
              <li>
                <button onClick={onEnterDashboard} className="hover:text-[#2d5a44] transition-colors cursor-pointer text-left">
                  Alur Kerja
                </button>
              </li>
              <li>
                <button onClick={onEnterDashboard} className="hover:text-[#2d5a44] transition-colors cursor-pointer text-left">
                  Spesifikasi
                </button>
              </li>
            </ul>
          </div>

          {/* Developers Column */}
          <div className="md:col-span-4 space-y-3.5">
            <h4 className="text-[10px] font-mono font-bold tracking-wider text-stone-500 uppercase block">
              Tim Pengembang
            </h4>
            <ul className="space-y-3">
              <li className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-medium text-stone-650">Muhammad Thifal</span>
                <span className="font-mono text-[10px] text-stone-400">F0501251009</span>
              </li>
              <li className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-medium text-stone-650">Lina Siti Kholifah</span>
                <span className="font-mono text-[10px] text-stone-400">F0501251007</span>
              </li>
            </ul>
          </div>

        </div>
      </footer>
    </div>
  );
}
