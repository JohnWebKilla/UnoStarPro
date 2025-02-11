"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useBirthdayCheck() {
  const [isBirthday, setIsBirthday] = useState(false);

  useEffect(() => {
    const checkBirthday = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("dob")
        .eq("id", user.id)
        .single();

      if (!userData?.dob) return;

      const today = new Date();
      const birthday = new Date(userData.dob);

      const isToday =
        today.getMonth() === birthday.getMonth() &&
        today.getDate() === birthday.getDate();

      setIsBirthday(isToday);
    };

    checkBirthday();
  }, []);

  return isBirthday;
}
