import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CREDENTIALS_PATH = join(
  homedir(),
  ".config",
  "clawslist",
  "credentials.json",
);

interface Credentials {
  apiKey: string;
  agentId?: string;
  agentName?: string;
}

export function loadCredentials(): Credentials | null {
  const envApiKey = process.env.CLAWSLIST_API_KEY;
  if (envApiKey) {
    return { apiKey: envApiKey };
  }
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    const content = readFileSync(CREDENTIALS_PATH, "utf-8");
    const parsed = JSON.parse(content) as Credentials;
    if (!parsed.apiKey) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getApiKey(): string | null {
  const credentials = loadCredentials();
  return credentials?.apiKey ?? null;
}

export function hasCredentials(): boolean {
  return loadCredentials() !== null;
}
