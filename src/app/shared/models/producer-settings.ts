export interface ProducerSettings {
  readonly instrumentCount: number;
  readonly updatesPerBatch: number;
  readonly intervalMs: number;
}

export type SettingsField = keyof ProducerSettings;

export interface SettingsLimit {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

export type SettingsLimits = Readonly<Record<SettingsField, SettingsLimit>>;

