import { GraphicsQuality, SettingsData } from '../types/game';
import {
  detectRecommendedQuality,
  getDefaultSettings,
  getGraphicsPresetOverrides,
} from './SaveManager';

type SettingsListener = (settings: SettingsData) => void;

export { detectRecommendedQuality, getGraphicsPresetOverrides };

export class SettingsManager {
  private settings: SettingsData;
  private listeners = new Set<SettingsListener>();

  constructor(initial: SettingsData) {
    this.settings = { ...initial };
  }

  get(): SettingsData {
    return { ...this.settings };
  }

  update(next: SettingsData): void {
    this.settings = { ...next };
    this.listeners.forEach((cb) => cb(this.get()));
  }

  applyQualityPreset(quality: GraphicsQuality): SettingsData {
    const overrides = getGraphicsPresetOverrides(quality);
    this.settings = { ...this.settings, ...overrides };
    this.listeners.forEach((cb) => cb(this.get()));
    return this.get();
  }

  resetToDefaults(): SettingsData {
    this.settings = getDefaultSettings();
    this.listeners.forEach((cb) => cb(this.get()));
    return this.get();
  }

  toggleMute(): boolean {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    this.listeners.forEach((cb) => cb(this.get()));
    return this.settings.muted;
  }

  subscribe(cb: SettingsListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
