import { createBrowserClient } from "@supabase/ssr";
import { CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = typeof window !== "undefined";

export const createClient = () => {
  // Log that we're creating a client
  if (isBrowser) {
    console.log(
      "Creating Supabase client with URL:",
      supabaseUrl.substring(0, 15) + "..."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey, {
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
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
};

// Modify the client after creation to ensure realtime is enabled
// This approach avoids TypeScript errors with the direct configuration
export const getRealTimeClient = () => {
  const client = createClient();

  if (isBrowser) {
    // Log that we're ensuring realtime is enabled
    console.log("Ensuring realtime is enabled for Supabase client");

    // Access the underlying Realtime instance and enable it
    // @ts-ignore - We're using a workaround to enable realtime
    if (client.realtime) {
      // @ts-ignore
      client.realtime.setAuth(client.auth.getSession());
    }
  }

  return client;
};

export default getRealTimeClient;
