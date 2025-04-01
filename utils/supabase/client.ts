import { createBrowserClient } from "@supabase/ssr";
import { CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = typeof window !== "undefined";

export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        if (!isBrowser) return undefined;
        const cookie = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${name}=`));
        return cookie ? cookie.split("=")[1] : undefined;
      },
      set(name: string, value: string, options: CookieOptions) {
        if (!isBrowser) return;
        let cookie = `${name}=${value}`;
        if (options.path) cookie += `; path=${options.path}`;
        if (options.maxAge) cookie += `; max-age=${options.maxAge}`;
        if (options.domain) cookie += `; domain=${options.domain}`;
        if (options.sameSite) cookie += `; samesite=${options.sameSite}`;
        if (options.secure) cookie += "; secure";
        document.cookie = cookie;
      },
      remove(name: string, options: CookieOptions) {
        if (!isBrowser) return;
        this.set(name, "", { ...options, maxAge: -1 });
      },
    },
  });

export default createClient;
