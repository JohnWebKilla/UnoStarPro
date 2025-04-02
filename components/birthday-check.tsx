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
      try {
        const supabase = createClient();

        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Error getting user:", userError);
          return;
        }

        if (!user) {
          console.log("No user found");
          return;
        }

        // Check if we've already shown the birthday today
        const todayString = new Date().toDateString();
        const storageKey = `birthdayShown_${user.id}`;

        try {
          const hasShownToday =
            localStorage.getItem(storageKey) === todayString;
          if (hasShownToday) {
            console.log("Already shown birthday overlay today");
            return;
          }
        } catch (storageError) {
          console.error("LocalStorage error:", storageError);
          // Continue execution even if localStorage fails
        }

        // Get user data
        const { data: userData, error: dbError } = await supabase
          .from("users")
          .select("first_name, dob")
          .eq("id", user.id)
          .single();

        if (dbError) {
          console.error("Error fetching user data:", dbError);
          return;
        }

        if (!userData?.dob) {
          console.log("No DOB found for user");
          return;
        }

        // Check if today is user's birthday
        const today = new Date();
        const birthday = new Date(userData.dob);

        const isBirthday =
          today.getMonth() === birthday.getMonth() &&
          today.getDate() === birthday.getDate();

        if (isBirthday && userData.first_name) {
          setUserName(userData.first_name);
          setShowBirthday(true);

          // Mark as shown for today
          try {
            localStorage.setItem(storageKey, todayString);
          } catch (storageError) {
            console.error("Error setting localStorage:", storageError);
            // Continue execution even if localStorage fails
          }
        }
      } catch (error) {
        console.error("Birthday check error:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkBirthday();
  }, []);

  const handleClose = () => {
    setShowBirthday(false);
  };

  if (isChecking || !showBirthday) return null;

  return <BirthdayOverlay userName={userName} onClose={handleClose} />;
}
