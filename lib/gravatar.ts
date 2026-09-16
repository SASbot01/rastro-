import { createHash } from "node:crypto";

/**
 * Gravatar: perfil publico asociado a un correo (nombre, foto, enlaces).
 * Solo se envia el hash MD5 del correo (es como funciona el servicio).
 * 404 = no hay perfil, que es lo normal.
 */

const TIMEOUT_MS = 8_000;

export interface GravatarProfile {
  hash: string;
  displayName: string | null;
  aboutMe: string | null;
  location: string | null;
  profileUrl: string;
  thumbnailUrl: string | null;
  urls: Array<{ title: string; value: string }>;
  accounts: Array<{ shortname: string; url: string }>;
}

export type GravatarResult = { checked: true; profile: GravatarProfile | null } | { checked: false; detail?: string };

interface Entry {
  hash?: string;
  displayName?: string;
  aboutMe?: string;
  currentLocation?: string;
  profileUrl?: string;
  thumbnailUrl?: string;
  urls?: Array<{ title?: string; value?: string }>;
  accounts?: Array<{ shortname?: string; url?: string }>;
}

export function gravatarHash(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

export async function getGravatar(email: string): Promise<GravatarResult> {
  const hash = gravatarHash(email);
  let response: Response;
  try {
    response = await fetch(`https://gravatar.com/${hash}.json`, {
      headers: { "user-agent": "Rastro (informe de exposicion personal)", accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    return { checked: false, detail: String(error) };
  }
  if (response.status === 404) return { checked: true, profile: null };
  if (!response.ok) return { checked: false, detail: `HTTP ${response.status}` };

  const data = (await response.json().catch(() => null)) as { entry?: Entry[] } | null;
  const e = data?.entry?.[0];
  if (!e) return { checked: true, profile: null };

  return {
    checked: true,
    profile: {
      hash,
      displayName: e.displayName ?? null,
      aboutMe: e.aboutMe ?? null,
      location: e.currentLocation ?? null,
      profileUrl: e.profileUrl ?? `https://gravatar.com/${hash}`,
      thumbnailUrl: e.thumbnailUrl ?? null,
      urls: (e.urls ?? []).filter((u): u is { title: string; value: string } => Boolean(u.value)).map((u) => ({ title: u.title ?? u.value, value: u.value })),
      accounts: (e.accounts ?? []).filter((a): a is { shortname: string; url: string } => Boolean(a.url)).map((a) => ({ shortname: a.shortname ?? "", url: a.url })),
    },
  };
}
