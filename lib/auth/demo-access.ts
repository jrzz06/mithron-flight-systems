type EnvSource = Record<string, string | undefined>;

/** Internal operator tooling only — never exposed on the public login page. */
export function isDemoSeedingEnabled(env: EnvSource = process.env) {
  return env.ALLOW_DEMO_SEED === "true";
}
