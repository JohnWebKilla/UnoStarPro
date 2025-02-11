"use client";

import { useEffect, useState } from "react";
import { BirthdayOverlay } from "./birthday-overlay";
import { createClient } from "@/utils/supabase/client";

export function BirthdayCheck() {
  const [showBirthday, setShowBirthday] = useState(false);
  const [userName, setUserName] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkBirthday = async () => {
      console.log("🎂 Starting birthday check...");

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.log("❌ No user found");
          return;
        }

        // Check if we've already shown the birthday today
        const todayString = new Date().toDateString();
        const storageKey = `birthdayShown_${user.id}`;
        const hasShownToday = localStorage.getItem(storageKey) === todayString;

        if (hasShownToday) {
          console.log("🎈 Already shown birthday overlay today for this user");
          return;
        }

        const { data: userData, error } = await supabase
          .from("users")
          .select("first_name, dob")
          .eq("id", user.id)
          .single();

        console.log("📅 User data:", userData);
        console.log("❌ Error if any:", error);

        if (!userData?.dob) {
          console.log("❌ No DOB found for user");
          return;
        }

        const today = new Date();
        const birthday = new Date(userData.dob);

        const isBirthday =
          today.getMonth() === birthday.getMonth() &&
          today.getDate() === birthday.getDate();

        console.log("🎉 Is Birthday?", isBirthday);

        if (isBirthday) {
          console.log("🎈 Setting birthday state for:", userData.first_name);
          setUserName(userData.first_name);
          setShowBirthday(true);
        }
      } catch (error) {
        console.error("Error checking birthday:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkBirthday();
  }, []);

  const handleClose = () => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const todayString = new Date().toDateString();
        localStorage.setItem(`birthdayShown_${user.id}`, todayString);
      }
    });
    setShowBirthday(false);
  };

  if (isChecking) return null;
  if (!showBirthday) return null;

  return <BirthdayOverlay userName={userName} onClose={handleClose} />;
}
