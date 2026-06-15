export enum GrowthPhase {
  LAG = "Lag Phase",
  EXPONENTIAL = "Exponential Phase",
  STATIONARY = "Stationary Phase",
  DEATH = "Death Phase",
}

export interface Thresholds {
  tempMin: number;
  tempMax: number;
  odTarget: number;
}

export interface DataPoint {
  id: string;
  day: string; // e.g. "Senin", "Selasa", etc.
  time: string; // ISO string or formatted time
  timestamp: number; // for sorting/charts
  temperature: number;
  opticalDensity: number;
  phase: GrowthPhase;
  tempStatus: "Normal" | "Overheat" | "Undercooled";
  odStatus: "Lagging" | "Growing" | "Optimal" | "Declining";
}

export interface BioReactorConfig {
  temperatureSetPoint: number;
  intervalMs: number;
  strain: string;
  maxOD: number;
}

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
  timestamp: number;
}

