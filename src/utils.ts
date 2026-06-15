/**
 * Helper function to get the status label and style classes based on Optical Density (OD) value
 * 
 * Spec:
 * | OD            | Status               |
 * | ------------- | -------------------- |
 * | < 1.0         | Fase Awal            |
 * | 1.0 – 2.39    | Pertumbuhan Cepat    |
 * | 2.4 – 3.79    | Siap Panen           |
 * | 3.8 – 4.79    | Overgrowth           |
 * | >= 4.8        | Kultur Kritis        |
 */
export function getODStatusInfo(od: number) {
  if (od < 1.0) {
    return {
      label: "Fase Awal",
      badgeClass: "text-slate-600 bg-slate-50 border-slate-200",
      colorClass: "text-slate-600",
      dotClass: "bg-slate-400",
    };
  } else if (od >= 1.0 && od <= 2.39) {
    return {
      label: "Pertumbuhan Cepat",
      badgeClass: "text-[#2d5a44] bg-[#e8ece9] border-[#d2ddd6]",
      colorClass: "text-[#2d5a44] font-bold",
      dotClass: "bg-[#2d5a44]",
    };
  } else if (od >= 2.4 && od <= 3.79) {
    return {
      label: "Siap Panen",
      badgeClass: "text-blue-700 bg-blue-50 border-blue-200 font-bold",
      colorClass: "text-blue-700 font-bold",
      dotClass: "bg-blue-600",
    };
  } else if (od >= 3.8 && od <= 4.79) {
    return {
      label: "Overgrowth",
      badgeClass: "text-[#b25329] bg-[#f9f1ec] border-[#f0ded4] font-semibold",
      colorClass: "text-[#b25329]",
      dotClass: "bg-[#b25329]",
    };
  } else {
    // od >= 4.8
    return {
      label: "Kultur Kritis",
      badgeClass: "text-red-700 bg-red-50 border-red-200 font-bold animate-pulse-subtle",
      colorClass: "text-red-700 font-bold",
      dotClass: "bg-red-600",
    };
  }
}
