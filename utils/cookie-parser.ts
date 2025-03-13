/**
 * Custom cookie parser that can handle base64-encoded cookies
 * This utility helps prevent the "Failed to parse cookie string" errors
 */

import { CookieOptions } from "@supabase/ssr";

/**
 * Safely parses a cookie value, handling base64-encoded cookies
 * @param value The cookie value to parse
 * @returns The parsed cookie value or the original value if parsing fails
 */
export function safeParseCookie(value: string | undefined): any {
  if (!value) return undefined;

  // If the cookie starts with 'base64-', return it as is
  if (value.startsWith("base64-")) {
    return value;
  }

  // Try to parse as JSON, but return the original value if parsing fails
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

/**
 * Gets a cookie value from the request
 * @param cookies The cookies object from the request
 * @param name The name of the cookie to get
 * @returns The cookie value, safely parsed
 */
export function getCookie(
  cookies: { get: (name: string) => { value: string } | undefined },
  name: string
): any {
  const cookie = cookies.get(name);
  return safeParseCookie(cookie?.value);
}

/**
 * Sets a cookie value on the response
 * @param cookies The cookies object from the response
 * @param name The name of the cookie to set
 * @param value The value to set
 * @param options Cookie options
 */
export function setCookie(
  cookies: {
    set: (options: {
      name: string;
      value: string;
      path?: string;
      maxAge?: number;
      domain?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none" | undefined;
    }) => void;
  },
  name: string,
  value: any,
  options: any = {}
): void {
  // If value is an object, stringify it
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  cookies.set({
    name,
    value: stringValue,
    ...options,
    sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
  });
}

export function parseCookieValue(
  value: string | undefined
): string | undefined {
  if (!value) return undefined;

  // If it's a base64 cookie (starts with 'base64-'), just return it as is
  if (value.startsWith("base64-")) {
    return value;
  }

  try {
    // For other cookies, try to parse if it looks like JSON
    if (value.startsWith("{") || value.startsWith("[")) {
      return JSON.parse(value);
    }
    return value;
  } catch {
    // If parsing fails, return the original value
    return value;
  }
}

export function serializeCookieValue(value: any): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const createCookieHandlers = (request: Request, response: Response) => ({
  get(name: string) {
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith(`${name}=`));
    if (!cookie) return undefined;

    const value = cookie.split("=")[1];
    return parseCookieValue(value);
  },

  set(name: string, value: string, options: CookieOptions) {
    const serializedValue = serializeCookieValue(value);
    response.headers.set(
      "Set-Cookie",
      `${name}=${serializedValue}; ${Object.entries(options)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ")}`
    );
  },

  remove(name: string, options: CookieOptions) {
    response.headers.set(
      "Set-Cookie",
      `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${Object.entries(
        options
      )
        .map(([key, value]) => `${key}=${value}`)
        .join("; ")}`
    );
  },
});
