import { useState, useEffect, useRef } from "react";
import {
  Thermometer,
  Eye,
  Settings,
  Play,
  Square,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Layers,
  Activity,
  Download,
  FlaskConical,
  Home,
} from "lucide-react";

import { GrowthPhase, Thresholds, DataPoint, Toast } from "./types";
import SensorCard from "./components/SensorCard";
import BioChart from "./components/BioCharts";
import ToastNotification from "./components/ToastNotification";
import ReportModal from "./components/ReportModal";
import LandingPage from "./components/LandingPage";
import { getODStatusInfo } from "./utils";

// Firebase imports
import { db, auth, OperationType, handleFirestoreError } from "./firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, deleteDoc } from "firebase/firestore";

// Pre-populate realistic cellular microalgae historical readings for beautiful visual presentation on load
const generateInitialLogs = (strain: string): DataPoint[] => {
  const initialPoints: DataPoint[] = [];
  const baseTime = new Date(Date.now() - 30 * 60000); // 30 minutes ago
  
  for (let i = 0; i < 15; i++) {
    const timeOffset = new Date(baseTime.getTime() + i * 2 * 60000);
    const timeFormatted = timeOffset.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dayFormatted = timeOffset.toLocaleDateString("id-ID", { weekday: "long" });

    // Simulate lag phase progressing to early exponential
    let temp = 34.8 + Math.sin(i / 2) * 0.2 + (Math.random() - 0.5) * 0.05;
    let od = i * 0.08 + 0.12 + Math.pow(i / 14, 2) * 1.1;
    let phase = GrowthPhase.LAG;
    if (i > 5) phase = GrowthPhase.EXPONENTIAL;
    
    initialPoints.push({
      id: `initial-${i}`,
      day: dayFormatted,
      time: timeFormatted,
      timestamp: timeOffset.getTime(),
      temperature: temp,
      opticalDensity: Number(od.toFixed(3)),
      phase,
      tempStatus: "Normal",
      odStatus: i > 5 ? "Growing" : "Lagging",
    });
  }

  return initialPoints;
};

export default function App() {
  // Navigation View State ('landing' / 'dashboard')
  const [currentView, setCurrentView] = useState<"landing" | "dashboard">("landing");

  // BioReactor State Parameters (Microalgae Strains)
  const [strain, setStrain] = useState<string>("Spirulina platensis");
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [firebaseStatus, setFirebaseStatus] = useState<"Offline" | "Connecting" | "Online">("Offline");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [temperature, setTemperature] = useState<number>(34.2);
  const [targetTemp, setTargetTemp] = useState<number>(35.0);
  const [opticalDensity, setOpticalDensity] = useState<number>(1.85);
  const [activePhase, setActivePhase] = useState<GrowthPhase>(GrowthPhase.EXPONENTIAL);
  
  // Custom threshold controls
  const [thresholds, setThresholds] = useState<Thresholds>({
    tempMin: 32.0,
    tempMax: 37.5,
    odTarget: 4.8,
  });

  // Simulation Logs
  const [dataPoints, setDataPoints] = useState<DataPoint[]>(() => generateInitialLogs("Spirulina platensis"));
  const [updateInterval, setUpdateInterval] = useState<number>(1800000); // Default to 30 minutes (1800000 ms)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[SYSTEM] Bioreaktor kultur diinisialisasi.",
    "[SYSTEM] Mode Simulasi Aktif.",
    "[INFO] Mikroalga: Spirulina platensis terpilih (Optimum: 35°C).",
  ]);

  // Terminal log scroll-lock helper
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  
  const addTerminalLog = (logMessage: string) => {
    const timeStamp = new Date().toLocaleTimeString("id-ID");
    setTerminalLogs((prev) => [...prev, `[${timeStamp}] ${logMessage}`].slice(-25));
  };

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Firebase auth state subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setFirebaseStatus("Online");
        addTerminalLog(`🔌 Firebase Terhubung sebagai: ${user.displayName || user.email}`);
      } else {
        setFirebaseStatus("Offline");
        addTerminalLog("🔌 Firebase Desinkronisasi / Belum login.");
      }
    });
    return () => unsubscribe();
  }, []);

  // Firebase database snapshot sync
  useEffect(() => {
    if (firebaseStatus !== "Online") return;

    const q = query(collection(db, "datapoints"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const points: DataPoint[] = [];
        snapshot.forEach((snapDoc) => {
          points.push({ id: snapDoc.id, ...snapDoc.data() } as DataPoint);
        });
        if (points.length > 0) {
          setDataPoints(points);
        }
      },
      (error) => {
        console.warn("Firestore error or missing permissions:", error.message);
      }
    );

    return () => unsubscribe();
  }, [firebaseStatus]);

  // Toast System State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // PDF Report Modal State
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  const triggerToast = (title: string, message: string, type: Toast["type"]) => {
    const newToast: Toast = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Track previous phase and temperature status to prevent alert spamming
  const prevODStatusLabelRef = useRef<string>(getODStatusInfo(opticalDensity).label);
  const prevTempStatusRef = useRef<"Normal" | "Overheat" | "Undercooled">("Normal");

  const currentODStatusLabel = getODStatusInfo(opticalDensity).label;

  // Growth Phase auto transition alerts based on cell incubation status
  useEffect(() => {
    if (prevODStatusLabelRef.current !== currentODStatusLabel) {
      triggerToast(
        "Transisi Fase Kultur",
        `Mikroalga "${strain}" bertransisi dari "${prevODStatusLabelRef.current}" ke "${currentODStatusLabel}"!`,
        "success"
      );
      prevODStatusLabelRef.current = currentODStatusLabel;
    }
  }, [currentODStatusLabel, strain]);

  // Temperature threshold check alerts
  const currentTempStatus = temperature > thresholds.tempMax
    ? "Overheat"
    : temperature < thresholds.tempMin
    ? "Undercooled"
    : "Normal";

  useEffect(() => {
    if (prevTempStatusRef.current !== currentTempStatus) {
      if (currentTempStatus === "Overheat") {
        triggerToast(
          "Anomali Termal: Terlalu Panas!",
          `Suhu saat ini ${temperature.toFixed(2)}°C melampaui batas maksimum (${thresholds.tempMax.toFixed(1)}°C) untuk strain kustom ini.`,
          "error"
        );
      } else if (currentTempStatus === "Undercooled") {
        triggerToast(
          "Anomali Termal: Terlalu Dingin!",
          `Suhu saat ini ${temperature.toFixed(2)}°C di bawah batas minimum (${thresholds.tempMin.toFixed(1)}°C).`,
          "warning"
        );
      } else if (currentTempStatus === "Normal" && (prevTempStatusRef.current === "Overheat" || prevTempStatusRef.current === "Undercooled")) {
        triggerToast(
          "Suhu Kembali Normal",
          `Suhu bioreaktor pulih kembali ke level optimum yaitu ${temperature.toFixed(2)}°C.`,
          "success"
        );
      }
      prevTempStatusRef.current = currentTempStatus;
    }
  }, [currentTempStatus, temperature, thresholds.tempMin, thresholds.tempMax]);

  // Track previous OD alert range status to prevent alert spamming
  const getODAlertCategory = (od: number): "NORMAL" | "SIAP_PANEN" | "OVERGROWTH" | "KULTUR_KRITIS" => {
    if (od >= 4.8) return "KULTUR_KRITIS";
    if (od >= 3.8) return "OVERGROWTH";
    if (od >= 2.4) return "SIAP_PANEN";
    return "NORMAL";
  };
  const prevODAlertStatusRef = useRef<"NORMAL" | "SIAP_PANEN" | "OVERGROWTH" | "KULTUR_KRITIS">(getODAlertCategory(opticalDensity));

  useEffect(() => {
    const currentCategory = getODAlertCategory(opticalDensity);

    if (prevODAlertStatusRef.current !== currentCategory) {
      if (currentCategory === "SIAP_PANEN") {
        triggerToast(
          "⚠️ Notifikasi Spirulina",
          `Optical Density : ${opticalDensity.toFixed(2)}\n\nStatus :\nSIAP PANEN\n\nKultur telah mencapai kepadatan optimal.\nDisarankan untuk melakukan panen.`,
          "warning"
        );
      } else if (currentCategory === "OVERGROWTH") {
        triggerToast(
          "⚠️ Peringatan Spirulina",
          `OD680 : ${opticalDensity.toFixed(2)}\n\nStatus :\nOVERGROWTH\n\nKepadatan kultur terlalu tinggi.\nSegera lakukan panen.`,
          "warning"
        );
      } else if (currentCategory === "KULTUR_KRITIS") {
        triggerToast(
          "🚨 PERINGATAN KRITIS",
          `OD680 : ${opticalDensity.toFixed(2)}\n\nStatus :\nKULTUR KRITIS\n\nKepadatan kultur telah melewati batas aman.\nRisiko self-shading, kekurangan nutrisi,\ndan kematian kultur meningkat.\nLakukan tindakan segera.`,
          "error"
        );
      }
      prevODAlertStatusRef.current = currentCategory;
    }
  }, [opticalDensity]);

  // Handle Strain Preset changes
  const handleStrainChange = (selectedStrain: string) => {
    setStrain(selectedStrain);
    let desc = "";
    
    if (selectedStrain === "Spirulina platensis") {
      setThresholds({ tempMin: 32.0, tempMax: 37.5, odTarget: 4.8 });
      setTargetTemp(35.0);
      desc = "Strain Spirulina platensis terpilih. Optimum pertumbuhan suhu: 35.0°C.";
    }

    addTerminalLog(desc);
  };

  // Run physical temperature seeking + biological OD calculation
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // 1. Simulasikan Perubahan Suhu (Simple seeker loop with random inertia noise)
      setTemperature((currTemp) => {
        const thermalLoss = (Math.random() - 0.5) * 0.08;
        const speedFactor = 0.12; // speed of heating/cooling
        const delta = (targetTemp - currTemp) * speedFactor;
        const nextTemp = currTemp + delta + thermalLoss;
        return Number(nextTemp.toFixed(2));
      });

      // 2. Simulasikan Pertumbuhan Optical Density (Based on active growth phase)
      setOpticalDensity((currOD) => {
        let deltaOD = 0.005; // default noise

        if (activePhase === GrowthPhase.LAG) {
          deltaOD = Math.random() * 0.015;
        } else if (activePhase === GrowthPhase.EXPONENTIAL) {
          // Accelerate faster if temperature is optimum
          const tempDiff = Math.abs(temperature - targetTemp);
          const tempEfficiency = Math.max(0.1, 1 - tempDiff / 4); // grows slower if too cold/hot
          deltaOD = (0.04 + Math.random() * 0.05) * tempEfficiency;
        } else if (activePhase === GrowthPhase.STATIONARY) {
          // Saturation fluctuates slightly around max
          deltaOD = (Math.random() - 0.5) * 0.02;
        } else if (activePhase === GrowthPhase.DEATH) {
          deltaOD = -0.015 - Math.random() * 0.01;
        }

        const nextOD = Math.max(0.1, currOD + deltaOD);
        return Number(nextOD.toFixed(3));
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isSimulating, targetTemp, activePhase, temperature, updateInterval]);

  // Log recorder loop
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // Determine temperature safety
      let tempStatus: "Normal" | "Overheat" | "Undercooled" = "Normal";
      if (temperature > thresholds.tempMax) tempStatus = "Overheat";
      else if (temperature < thresholds.tempMin) tempStatus = "Undercooled";

      // Determine OD status description
      let odStatus: "Lagging" | "Growing" | "Optimal" | "Declining" = "Optimal";
      if (activePhase === GrowthPhase.LAG) odStatus = "Lagging";
      else if (activePhase === GrowthPhase.EXPONENTIAL) odStatus = "Growing";
      else if (activePhase === GrowthPhase.DEATH) odStatus = "Declining";

      const newTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const newDay = new Date().toLocaleDateString("id-ID", { weekday: "long" });

      const newPoint: DataPoint = {
        id: crypto.randomUUID(),
        day: newDay,
        time: newTime,
        timestamp: Date.now(),
        temperature,
        opticalDensity,
        phase: activePhase,
        tempStatus,
        odStatus,
      };

      if (firebaseStatus === "Online") {
        try {
          addDoc(collection(db, "datapoints"), {
            day: newPoint.day,
            time: newPoint.time,
            timestamp: newPoint.timestamp,
            temperature: newPoint.temperature,
            opticalDensity: newPoint.opticalDensity,
            phase: newPoint.phase,
            tempStatus: newPoint.tempStatus,
            odStatus: newPoint.odStatus,
          });
          addTerminalLog(`🔄 Firebase push: Temp=${temperature.toFixed(2)}°C, OD=${opticalDensity.toFixed(3)} SUCCESS.`);
        } catch (error) {
          console.error("Firestore push error:", error);
          addTerminalLog("❌ Gagal mengirim telemetri ke Firebase Firestore.");
        }
      } else {
        setDataPoints((prev) => [...prev, newPoint]);
        addTerminalLog(`💾 Local log: Temp=${temperature.toFixed(2)}°C, OD=${opticalDensity.toFixed(3)}`);
      }

      // Handle auto transition of biological growth stages
      if (activePhase === GrowthPhase.LAG && opticalDensity > 0.45) {
        setActivePhase(GrowthPhase.EXPONENTIAL);
        addTerminalLog("⚠️ Sel memasuki Fase Eksponensial (Exponential Growth Phase)!");
      } else if (activePhase === GrowthPhase.EXPONENTIAL && opticalDensity > thresholds.odTarget) {
        setActivePhase(GrowthPhase.STATIONARY);
        addTerminalLog("🔋 Kepadatan Optimum tercapai. Sel memasuki Fase Stasioner!");
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isSimulating, temperature, opticalDensity, activePhase, thresholds, firebaseStatus, updateInterval]);

  // Actions
  const handleConnectFirebase = async () => {
    if (firebaseStatus === "Online") {
      try {
        setFirebaseStatus("Offline");
        await signOut(auth);
        addTerminalLog("Disconnecting from Firebase Realtime Database...");
        addTerminalLog("[INFO] Koneksi terputus. Data disimpan secara lokal.");
        triggerToast("Info", "Berhasil keluar dari akun Firebase", "info");
      } catch (error) {
        triggerToast("Error", "Gagal keluar: " + (error instanceof Error ? error.message : String(error)), "error");
      }
      return;
    }

    setFirebaseStatus("Connecting");
    addTerminalLog("Inisialisasi otentikasi Google Sign-In untuk Firebase...");
    addTerminalLog("Menghubungkan ke layanan Google Firebase Auth...");
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setFirebaseStatus("Offline");
      addTerminalLog("❌ Gagal terhubung ke Firebase: " + (error instanceof Error ? error.message : String(error)));
      triggerToast("Koneksi Gagal", "Pastikan kredensial Firebase terisi dan diijinkan.", "error");
    }
  };

  const clearLogs = async () => {
    if (firebaseStatus === "Online") {
      try {
        addTerminalLog("🗑️ Menghapus data histori di Firestore...");
        dataPoints.forEach(async (point) => {
          if (!point.id.startsWith("initial-")) {
            await deleteDoc(doc(db, "datapoints", point.id));
          }
        });
        triggerToast("Sukses", "Data Firebase berhasil dibersihkan", "success");
      } catch (error) {
        console.error("Firestore clear logs error:", error);
      }
    }
    setDataPoints([]);
    addTerminalLog("🗑️ Log riwayat dibersihkan.");
  };

  // Open PDF Report Preview
  const handleOpenReport = () => {
    if (dataPoints.length === 0) {
      triggerToast("Peringatan", "Tidak ada data sampel untuk menyusun laporan!", "warning");
      return;
    }
    setIsReportOpen(true);
    addTerminalLog("📋 Membuka pratinjau lembar laporan PDF resmi.");
  };

  if (currentView === "landing") {
    return (
      <>
        <LandingPage
          onEnterDashboard={() => setCurrentView("dashboard")}
          currentTemp={temperature}
          currentOD={opticalDensity}
          isSimulating={isSimulating}
        />
        <ToastNotification toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-[#faf9f6] text-[#292524] font-sans selection:bg-[#2d5a44]/20 selection:text-[#2d5a44] pb-12 ${isReportOpen ? "no-print" : ""}`}>
      {/* Header */}
      <header className="border-b border-stone-200/90 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#2d5a44]/10 text-[#2d5a44] rounded-xl border border-[#2d5a44]/15">
              <FlaskConical className="w-6 h-6 text-[#2d5a44]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-semibold text-xl text-[#1e2a22] tracking-tight">
                  🔬 Smart BioReactor Dashboard
                </h1>
                <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200 font-mono font-bold">
                  ESP32 + Firebase RTDB
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Sistem Pemantauan Pertumbuhan Sel & Telemetri Fotometrik Mikroalga *(Spirulina platensis)*
              </p>
            </div>
          </div>

          {/* Connection Status Panel */}
          <div className="flex flex-wrap items-center gap-3 bg-stone-50 p-1.5 rounded-xl border border-stone-200 text-xs text-stone-700">
            {/* Back to landing page button */}
            <button
              onClick={() => {
                setCurrentView("landing");
                addTerminalLog("🏠 Navigasi kembali ke Beranda Landing Page.");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-white text-stone-700 hover:bg-stone-50 hover:text-[#2d5a44] border border-stone-200 cursor-pointer shadow-sm text-xs transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-[#2d5a44]" />
              Beranda
            </button>

            {/* Real-time Indicator status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-200 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSimulating ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isSimulating ? "bg-[#2d5a44]" : "bg-rose-500"
                  }`}
                />
              </span>
              <span className="font-mono text-[9px] font-bold text-stone-600 uppercase tracking-wider">
                {isSimulating ? "SIMULASI AKTIF" : "PAUSED"}
              </span>
            </div>

            {/* Firebase connection helper label */}
            <button
              onClick={handleConnectFirebase}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shadow-sm text-xs border ${
                firebaseStatus === "Online"
                  ? "bg-[#e8ece9] text-[#2d5a44] border-[#d2ddd6]"
                  : firebaseStatus === "Connecting"
                  ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                  : "bg-white text-stone-700 hover:bg-stone-50 border-stone-200"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {firebaseStatus === "Online"
                ? "Connected to Firebase"
                : firebaseStatus === "Connecting"
                ? "Connecting Firebase..."
                : "Connect Firebase"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        {/* Quick Settings Bar / Bioreactor Culture Preset Selector */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-stretch gap-3">
            <div className="p-2.5 bg-[#2d5a44]/10 text-[#2d5a44] rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#2d5a44]" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-stone-400 font-bold uppercase tracking-wider">
                Media & Kultur Organisme
              </span>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-display font-medium text-sm text-[#1e2a22]">
                  Spesies Mikroalga:
                </span>
                <span className="bg-[#e8ece9] text-[#2d5a44] border border-[#d2ddd6] rounded-xl px-3 py-1.5 text-xs font-semibold font-mono shadow-xs flex items-center gap-1.5 animate-pulse-subtle">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2d5a44]" />
                  Spirulina platensis (Optimum 35°C)
                </span>
              </div>
            </div>
          </div>

          {/* Current incubation stage bar */}
          {(() => {
            const odStatusInfo = getODStatusInfo(opticalDensity);
            const currentStatusLabel = odStatusInfo.label;
            return (
              <div className="flex-1 w-full max-w-md bg-stone-50 rounded-xl p-3.5 border border-stone-200/80 text-xs">
                <div className="flex justify-between mb-1.5 font-mono text-[10px]">
                  <span className="text-stone-400 font-bold">FASE INKUBASI SEL:</span>
                  <span className={`font-bold uppercase ${odStatusInfo.colorClass}`}>{currentStatusLabel}</span>
                </div>
                <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                  <div
                    className={`transition-all duration-500 ${
                      currentStatusLabel === "Fase Awal" ? "w-[20%] bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.3)]" : "w-[20%] bg-slate-500/20"
                    }`}
                  />
                  <div
                    className={`transition-all duration-500 ${
                      currentStatusLabel === "Pertumbuhan Cepat"
                        ? "w-[20%] bg-[#2d5a44] shadow-[0_0_8px_rgba(45,90,68,0.3)]"
                        : "w-[20%] bg-[#2d5a44]/20"
                    }`}
                  />
                  <div
                    className={`transition-all duration-500 ${
                      currentStatusLabel === "Siap Panen"
                        ? "w-[20%] bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
                        : "w-[20%] bg-blue-600/20"
                    }`}
                  />
                  <div
                    className={`transition-all duration-500 ${
                      currentStatusLabel === "Overgrowth"
                        ? "w-[20%] bg-[#b25329] shadow-[0_0_8px_rgba(178,83,41,0.3)]"
                        : "w-[20%] bg-[#b25329]/20"
                    }`}
                  />
                  <div
                    className={`transition-all duration-500 ${
                      currentStatusLabel === "Kultur Kritis"
                        ? "w-[20%] bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.3)]"
                        : "w-[20%] bg-red-600/20"
                    }`}
                  />
                </div>
                <div className="flex justify-between text-[7px] md:text-[8px] font-mono font-bold text-stone-400 mt-1">
                  <span>FASE AWAL</span>
                  <span>PERTUMBUHAN CEPAT</span>
                  <span>SIAP PANEN</span>
                  <span>OVERGROWTH</span>
                  <span>KULTUR KRITIS</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Row 1: Primary Sensor Metrics of Bioreactor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Temperature sensor card */}
          <SensorCard
            title="Suhu Bioreaktor"
            subTitle="Sensor DS18B20 Thermowell"
            value={temperature}
            unit="°C"
            statusText={
              temperature > thresholds.tempMax
                ? "TERLALU PANAS"
                : temperature < thresholds.tempMin
                ? "TERLALU DINGIN"
                : "OPTIMUM"
            }
            statusType={
              temperature > thresholds.tempMax
                ? "error"
                : temperature < thresholds.tempMin
                ? "warning"
                : "success"
            }
            rangeText={`${thresholds.tempMin.toFixed(1)} - ${thresholds.tempMax.toFixed(1)} °C`}
            icon={Thermometer}
            channel="CH-01 / ANALOG_IN_DS"
          />

          {/* Optical Density sensor card */}
          {(() => {
            const odStatusInfo = getODStatusInfo(opticalDensity);
            const getODStatusType = (label: string): "info" | "success" | "warning" | "error" => {
              if (label === "Fase Awal") return "info";
              if (label === "Pertumbuhan Cepat") return "success";
              if (label === "Siap Panen") return "success";
              if (label === "Overgrowth") return "warning";
              return "error";
            };
            return (
              <SensorCard
                title="Optical Density"
                subTitle="Turbidimeter Beer-Lambert 600nm"
                value={opticalDensity}
                unit="OD600"
                statusText={odStatusInfo.label}
                statusType={getODStatusType(odStatusInfo.label)}
                rangeText={`Target: > ${thresholds.odTarget.toFixed(1)} OD`}
                icon={Eye}
                channel="CH-02 / ADC1_CH6"
              />
            );
          })()}
        </div>

        {/* Row 2: Live Historical Plots */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BioChart
            data={dataPoints}
            title="Riwayat Suhu Inkubasi"
            color={
              temperature > thresholds.tempMax || temperature < thresholds.tempMin ? "copper" : "emerald"
            }
            unit="°C"
            metric="temperature"
            minVal={thresholds.tempMin}
            maxVal={thresholds.tempMax}
          />

          <BioChart
            data={dataPoints}
            title="Fase Pertumbuhan Sel (Optical Density)"
            color="emerald"
            unit="OD"
            metric="opticalDensity"
            minVal={0.1}
            maxVal={thresholds.odTarget}
          />
        </div>

        {/* Row 3: Bioreactor Control Grid & Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PID Parameter / Control Center */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 relative shadow-sm">
            <h3 className="font-display font-medium text-[#1e2a22] flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-[#2d5a44]" />
              <span>Panel Kontrol Kondisi Bioreaktor</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sliders Block */}
              <div className="space-y-4">
                {/* Target Temperature Set Point Slider */}
                <div className="space-y-2 bg-stone-50 p-4 rounded-xl border border-stone-150 shadow-xs">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-500 font-bold">SUHU TARGET (SET_POINT):</span>
                    <span className="text-[#2d5a44] font-bold">{targetTemp.toFixed(1)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="45"
                    step="0.5"
                    value={targetTemp}
                    onChange={(e) => setTargetTemp(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#2d5a44]"
                  />
                  <div className="flex justify-between text-[8px] font-mono font-bold text-stone-400">
                    <span>15.0°C</span>
                    <span>35.0°C (Optimum)</span>
                    <span>45.0°C (Batas)</span>
                  </div>
                </div>

                {/* Optical Density (OD) Direct Slider Control */}
                <div className="space-y-2 bg-[#e8ece9]/40 p-4 rounded-xl border border-[#d2ddd6] shadow-xs">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-600 font-bold">OPTICAL DENSITY (SIMULATOR):</span>
                    <span className="text-[#2d5a44] font-bold">{opticalDensity.toFixed(3)} OD</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="5.20"
                    step="0.01"
                    value={opticalDensity}
                    onChange={(e) => setOpticalDensity(Number(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#2d5a44]"
                  />
                  <div className="flex justify-between text-[8px] font-mono font-bold text-[#2d5a44]/80">
                    <span>0.10 OD (Awal)</span>
                    <span>2.56 OD (Siap Panen)</span>
                    <span>4.12 OD (Overgrowth)</span>
                    <span>4.95 OD (Kritis)</span>
                  </div>
                </div>

                {/* Interval Ticks Control */}
                <div className="space-y-2 bg-stone-50 p-4 rounded-xl border border-stone-150">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-stone-500 font-bold">INTERVAL UPDATE:</span>
                    <span className="text-[#2d5a44] font-bold">
                      {updateInterval >= 60000 ? `${(updateInterval / 60000).toFixed(0)} Menit` : `${(updateInterval / 1000).toFixed(0)} Detik`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[5000, 60000, 900000, 1800000].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => {
                          setUpdateInterval(ms);
                          const label = ms >= 60000 ? `${ms / 60000} Menit` : `${ms / 1000} Detik`;
                          addTerminalLog(`⏱️ Interval refresh diubah ke ${label}`);
                        }}
                        className={`py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          updateInterval === ms
                            ? "bg-[#e8ece9] text-[#2d5a44] border-[#d2ddd6] font-bold"
                            : "bg-white text-stone-500 border-stone-200 hover:text-stone-800"
                        }`}
                      >
                        {ms >= 60000 ? `${ms / 60000} Menit` : `${ms / 1000} Detik`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Operational Controls Block */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2 bg-stone-50 p-4 rounded-xl border border-stone-150 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-stone-400 block uppercase mb-2">
                      Kontrol Jalannya Simulasi
                    </span>
                    <p className="text-xs text-stone-500 leading-relaxed mb-4">
                      Gunakan tombol jalankan/tangguhkan untuk mengontrol laju data real-time, atau bersihkan log riwayat dan ekspor database ke laporan format PDF resmi.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 justify-between items-center pt-2 border-t border-stone-200 font-mono">
                    {/* Play & Pause triggers */}
                    <div className="flex p-1 bg-stone-150 rounded-xl border border-stone-200">
                      <button
                        onClick={() => {
                          setIsSimulating(true);
                          addTerminalLog("[INFO] Simulasi dilanjutkan.");
                        }}
                        className={`p-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          isSimulating
                            ? "bg-white text-[#2d5a44] shadow-xs font-bold"
                            : "text-stone-400 hover:text-stone-700"
                        }`}
                        title="Mulai Simulasi"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsSimulating(false);
                          addTerminalLog("[INFO] Simulasi ditangguhkan.");
                        }}
                        className={`p-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          !isSimulating
                            ? "bg-white text-rose-500 shadow-xs font-bold"
                            : "text-stone-400 hover:text-stone-700"
                        }`}
                        title="Hentikan Simulasi"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={clearLogs}
                        className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-xl text-xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                      <button
                        onClick={handleOpenReport}
                        className="px-3.5 py-2 bg-[#2d5a44] hover:bg-[#254a37] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Laporan PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnostics terminal logs */}
          <div className="bg-white border border-stone-200 shadow-sm rounded-2xl p-6 flex flex-col h-full overflow-hidden">
            <h3 className="font-display font-medium text-[#1e2a22] flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-400" />
              </span>
              <span>Sinyal Konsol Telemetri ESP32</span>
            </h3>

            {/* Ivory Monospaced Live Console logs */}
            <div 
              ref={terminalContainerRef}
              className="bg-stone-50 border border-stone-200/90 rounded-xl p-4 font-mono text-[10px] space-y-2 h-[220px] max-h-[220px] min-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent"
            >
              {terminalLogs.map((log, idx) => {
                let textClass = "text-stone-600";
                if (log.includes("[SUCCESS]") || log.includes("🔌") || log.includes("transmisi")) textClass = "text-[#2d5a44] font-medium";
                else if (log.includes("[SYSTEM]") || log.includes("diinisialisasi")) textClass = "text-blue-700";
                else if (log.includes("⚠️") || log.includes("Fase")) textClass = "text-amber-800 font-medium";
                else if (log.includes("🔥") || log.includes("❄️")) textClass = "text-[#b25329] font-semibold";

                return (
                  <div key={idx} className={`${textClass} leading-relaxed`}>
                    {log}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-stone-50 p-2 border border-stone-200 rounded-lg">
                <span className="text-stone-400 text-[8px] font-bold block uppercase">METRIKS TERKUMPUL</span>
                <span className="text-stone-800 font-bold text-lg">{dataPoints.length}</span>
              </div>
              <div className="bg-stone-50 p-2 border border-stone-200 rounded-lg">
                <span className="text-stone-400 text-[8px] font-bold block uppercase">KONEKSI_TX</span>
                <span className="text-[#2d5a44] font-bold text-base">9.6 kbps</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 4: Historical Database Log of the Bioreactor */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-display font-medium text-[#1e2a22] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#2d5a44]" />
                <span>Log Tabel Riwayat Terbaru (Database Cache)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Representasi cache data lokal yang tersinkronisasi langsung dengan Firebase RTDB
              </p>
            </div>
            <div className="text-xs font-mono bg-stone-50 py-1.5 px-3 rounded-lg border border-stone-200 text-stone-600">
              Menampilkan {Math.min(dataPoints.length, 10)} riwayat terbaru
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
            <table className="w-full text-left border-collapse text-xs select-all">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-mono tracking-wider sticky top-0 z-10 shadow-overlay">
                  <th className="py-3 px-6 bg-stone-50">HARI</th>
                  <th className="py-3 px-6 bg-stone-50">WAKTU</th>
                  <th className="py-3 px-6 bg-stone-50">SUHU SEBENARNYA (°C)</th>
                  <th className="py-3 px-6 bg-stone-50">STATUS SUHU</th>
                  <th className="py-3 px-6 bg-stone-50">OPTICAL DENSITY (OD)</th>
                  <th className="py-3 px-6 bg-stone-50">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {dataPoints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center text-stone-400 font-sans">
                      ⏳ Menunggu data masuk... Silakan aktifkan simulasi di atas.
                    </td>
                  </tr>
                ) : (
                  [...dataPoints].reverse().slice(0, 10).map((dp, idx) => {
                    const tempBadge = {
                      Normal: "text-[#2d5a44] bg-[#e8ece9] border-[#d2ddd6]",
                      Overheat: "text-[#b25329] bg-[#f9f1ec] border-[#f0ded4] font-bold",
                      Undercooled: "text-amber-800 bg-amber-50 border-amber-200",
                    }[dp.tempStatus];

                    const statusInfo = getODStatusInfo(dp.opticalDensity);

                    return (
                      <tr
                        key={dp.id}
                        className="hover:bg-stone-50/50 transition-colors border-b border-stone-100 text-stone-700"
                      >
                        <td className="py-3.5 px-6 text-stone-500 font-medium">{dp.day}</td>
                        <td className="py-3.5 px-6 font-semibold text-stone-900">{dp.time}</td>
                        <td className="py-3.5 px-6 text-stone-800">{dp.temperature.toFixed(2)} °C</td>
                        <td className="py-3.5 px-6">
                          <span className={`px-2 py-0.5 rounded border text-[10px] ${tempBadge}`}>
                            {dp.tempStatus === "Normal" ? "✓ NORMAL" : dp.tempStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-[#2d5a44] font-bold">
                          {dp.opticalDensity.toFixed(3)}
                        </td>
                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${statusInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
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

        {/* Educational Info box footer */}
        <div className="bg-[#e8ece9]/50 border border-[#2d5a44]/15 rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start">
          <span className="text-xl p-2 bg-[#2d5a44]/10 rounded-xl">📘</span>
          <div className="space-y-1.5 text-xs text-stone-600 leading-relaxed">
            <h4 className="font-display font-medium text-[#1e2a22]">
              Sekilas Bio-Proses & Fotometrik OD600
            </h4>
            <p>
              Prinsip pemantauan <strong className="text-stone-800">Optical Density (OD600)</strong> didasarkan pada hukum Beer-Lambert, mengukur tingkat hamburan cahaya suspensi kultur menggunakan sensor intensitas photo-diode pada panjang gelombang ~600-650nm. Suhu dikendalikan secara presisi melalui loop aktuator pemanas/coolant terautomasi demi mempertahankan aktivitas biologis optimum.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-stone-200 pt-8 pb-12 text-center text-stone-400 text-xs">
        <p>Smart BioReactor Telemetry | ESP32 + Firebase Realtime Database Integration</p>
        <p className="mt-1 text-[10px] text-stone-400">
          Dirancang dengan fokus presisi termal & visualibilitas biomasa real-time.
        </p>
      </footer>

      {/* Floating notifications tray */}
      <ToastNotification toasts={toasts} onClose={removeToast} />

      {/* PDF Report Modal Component */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        dataPoints={dataPoints}
        strain={strain}
        activePhase={activePhase}
        thresholds={thresholds}
        temperature={temperature}
        targetTemp={targetTemp}
      />
    </div>
  );
}

