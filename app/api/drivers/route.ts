import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getCache, setCache } from "@/lib/redis";
import {
  DRIVER_LIST_KEY,
  CACHE_EXPIRATION,
} from "@/app/(protected)/Drivers/cache";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user's session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to get from cache first
    const cachedDrivers = await getCache(DRIVER_LIST_KEY);
    if (cachedDrivers) {
      console.log("Using cached drivers from Redis in API");
      return NextResponse.json(cachedDrivers);
    }

    // First, get the basic driver data without company filtering
    let driversQuery = supabase.from("drivers").select("*");

    // Order by creation date, newest first
    const { data: drivers, error: driversError } = await driversQuery.order(
      "created_at",
      { ascending: false }
    );

    if (driversError) {
      console.error("Drivers error:", driversError);
      return NextResponse.json(
        { error: "Failed to fetch drivers" },
        { status: 500 }
      );
    }

    // If we have drivers, try to fetch their documents
    if (drivers && drivers.length > 0) {
      const driversWithDocs = await Promise.all(
        drivers.map(async (driver) => {
          try {
            // Fetch licenses if the table exists
            const { data: licenses } = await supabase
              .from("driver_licenses")
              .select("*")
              .eq("driver_id", driver.id)
              .then((res) => res || { data: [] });

            // Fetch medical cards if the table exists
            const { data: medicalCards } = await supabase
              .from("medical_cards")
              .select("*")
              .eq("driver_id", driver.id)
              .then((res) => res || { data: [] });

            // Fetch MVR records if the table exists
            const { data: mvrRecords } = await supabase
              .from("mvr_records")
              .select("*")
              .eq("driver_id", driver.id)
              .then((res) => res || { data: [] });

            return {
              ...driver,
              driver_licenses: licenses || [],
              medical_cards: medicalCards || [],
              mvr_files: mvrRecords || [],
            };
          } catch (error) {
            console.error(
              `Error fetching documents for driver ${driver.id}:`,
              error
            );
            return {
              ...driver,
              driver_licenses: [],
              medical_cards: [],
              mvr_files: [],
            };
          }
        })
      );

      // Cache the result
      await setCache(DRIVER_LIST_KEY, driversWithDocs, CACHE_EXPIRATION);

      return NextResponse.json(driversWithDocs);
    }

    // Cache empty array if no drivers found
    const emptyResult = drivers || [];
    await setCache(DRIVER_LIST_KEY, emptyResult, CACHE_EXPIRATION);

    return NextResponse.json(emptyResult);
  } catch (error) {
    console.error("Error in drivers API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driverData = await request.json();

    // Validate required fields
    const requiredFields = ["name", "phone_number", "truck_number", "status"];
    const missingFields = requiredFields.filter((field) => !driverData[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Set default values if not provided
    if (!driverData.hire_date) {
      driverData.hire_date = new Date().toISOString();
    }

    if (!driverData.subscription_amount) {
      driverData.subscription_amount = 0;
    }

    // Insert the driver data
    const { data, error } = await supabase
      .from("drivers")
      .insert(driverData)
      .select()
      .single();

    if (error) {
      console.error("Driver insert error:", error);
      return NextResponse.json(
        { error: "Failed to create driver" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating driver:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
