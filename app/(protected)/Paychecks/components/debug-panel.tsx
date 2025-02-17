"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

interface DebugPanelProps {
  data: any;
  error: any;
}

export function DebugPanel({ data, error }: DebugPanelProps) {
  const [userInfo, setUserInfo] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getUserInfo() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        setUserInfo({ auth: user, profile: userData });
      }
    }
    getUserInfo();
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-black/90 text-white rounded-lg max-w-lg max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">Debug Info</h3>
      {error && (
        <div className="mb-4">
          <h4 className="text-red-400">Error:</h4>
          <pre className="text-xs">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
      <div className="mb-4">
        <h4 className="text-blue-400">User Info:</h4>
        <pre className="text-xs">{JSON.stringify(userInfo, null, 2)}</pre>
      </div>
      <div>
        <h4 className="text-green-400">Data:</h4>
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
