type EnvOverrideMap = Record<string, string | undefined>;

type EnvSnapshotEntry = {
  existed: boolean;
  value: string | undefined;
};

export type EnvSnapshot = Record<string, EnvSnapshotEntry>;

export function applyEnvOverrides(overrides: EnvOverrideMap): EnvSnapshot {
  const snapshot: EnvSnapshot = {};

  for (const [key, value] of Object.entries(overrides)) {
    snapshot[key] = {
      existed: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key],
    };

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return snapshot;
}

export function restoreEnv(snapshot: EnvSnapshot): void {
  for (const [key, entry] of Object.entries(snapshot)) {
    if (!entry.existed) {
      delete process.env[key];
      continue;
    }

    if (entry.value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = entry.value;
    }
  }
}