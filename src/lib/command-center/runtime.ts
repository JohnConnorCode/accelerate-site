const rawOrigin = process.env.NEXT_PUBLIC_COMMAND_CENTER_ORIGIN?.trim().replace(/\/$/, "");

function validOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const origin = new URL(value);
    return origin.protocol === "http:" || origin.protocol === "https:" ? origin.origin : null;
  } catch {
    return null;
  }
}

const configuredOrigin = validOrigin(rawOrigin);

export const commandCenterOrigin = configuredOrigin || null;

export function commandCenterHost() {
  if (!configuredOrigin) return null;
  try {
    return new URL(configuredOrigin).host;
  } catch {
    return null;
  }
}

export function isCommandCenterHost(host: string) {
  const expected = commandCenterHost();
  return !expected || host === expected;
}

export function commandCenterUrl(pathname: string) {
  if (!configuredOrigin) return pathname;
  return `${configuredOrigin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
