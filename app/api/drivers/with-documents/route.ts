import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getCache, setCache } from "@/lib/redis";
import {
  clearDriverCache,
  clearDriverListCache,
} from "@/app/(protected)/Drivers/cache";
import {
  DRIVER_LIST_KEY,
  CACHE_EXPIRATION,
} from "@/app/(protected)/Drivers/constants";
import { nanoid } from "nanoid";

// Helper function to store a file in Storage and get its URL
async function storeFile(
  supabase: SupabaseClient,
  file: File,
  bucket: string,
  folder: string
): Promise<{ fileName: string; fileUrl: string; filePath: string } | null> {
  if (!file) return null;

  // Create a unique filename
  const fileExt = file.name.split(".").pop();
  const fileName = `${nanoid()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  // Upload the file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error(`Error uploading ${file.name}:`, uploadError);
    throw new Error(`Failed to upload ${file.name}`);
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    fileName: fileName,
    fileUrl: publicUrl,
    filePath: filePath,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the form data
    const formData = await request.formData();

    // Get driver data
    const driverDataJson = formData.get("driverData");
    if (!driverDataJson || typeof driverDataJson !== "string") {
      return NextResponse.json(
        { error: "Driver data is required" },
        { status: 400 }
      );
    }

    // Parse the driver data
    let driverData;
    try {
      driverData = JSON.parse(driverDataJson);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid driver data" },
        { status: 400 }
      );
    }

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

    // Extract the files
    const licenseFile = formData.get("license_file") as File;
    const medicalCardFile = formData.get("medical_card_file") as File;
    const mvrFile = formData.get("mvr_file") as File;

    // Start a transaction
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .insert(driverData)
      .select()
      .single();

    if (driverError) {
      console.error("Driver insert error:", driverError);
      return NextResponse.json(
        { error: "Failed to create driver" },
        { status: 500 }
      );
    }

    // Upload files if they exist
    const uploadPromises: Promise<void>[] = [];

    if (licenseFile) {
      uploadPromises.push(
        storeFile(supabase, licenseFile, "driver-documents", "licenses").then(
          async (fileData) => {
            if (fileData) {
              const { data, error } = await supabase
                .from("driver_licenses")
                .insert({
                  driver_id: driver.id,
                  file_name: fileData.fileName,
                  file_url: fileData.fileUrl,
                  license_file_url: fileData.fileUrl,
                  status: "active",
                  expiration_date: new Date(
                    new Date().setFullYear(new Date().getFullYear() + 1)
                  ).toISOString(),
                });

              if (error) {
                console.error("Error inserting license:", error);
              }
            }
          }
        )
      );
    }

    if (medicalCardFile) {
      uploadPromises.push(
        storeFile(
          supabase,
          medicalCardFile,
          "driver-documents",
          "medical-cards"
        ).then(async (fileData) => {
          if (fileData) {
            const { data, error } = await supabase
              .from("medical_cards")
              .insert({
                driver_id: driver.id,
                file_name: fileData.fileName,
                file_url: fileData.fileUrl,
                status: "active",
                expiration_date: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1)
                ).toISOString(),
              });

            if (error) {
              console.error("Error inserting medical card:", error);
            }
          }
        })
      );
    }

    if (mvrFile) {
      uploadPromises.push(
        storeFile(supabase, mvrFile, "driver-documents", "mvr-records").then(
          async (fileData) => {
            if (fileData) {
              const { data, error } = await supabase
                .from("mvr_records")
                .insert({
                  driver_id: driver.id,
                  file_name: fileData.fileName,
                  mvr_file_url: fileData.fileUrl,
                  status: "active",
                  expiration_date: new Date(
                    new Date().setFullYear(new Date().getFullYear() + 1)
                  ).toISOString(),
                });

              if (error) {
                console.error("Error inserting MVR record:", error);
              }
            }
          }
        )
      );
    }

    // Wait for all uploads to complete
    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
    }

    // Clear the cache
    await clearDriverListCache();
    await clearDriverCache(driver.id);

    // Fetch the driver with documents
    const { data: driverWithDocs, error: driverWithDocsError } = await supabase
      .from("drivers")
      .select(
        `
        *,
        driver_licenses(*),
        medical_cards(*),
        mvr_records(*)
      `
      )
      .eq("id", driver.id)
      .single();

    if (driverWithDocsError) {
      console.error(
        "Error fetching driver with documents:",
        driverWithDocsError
      );
      return NextResponse.json(driver);
    }

    return NextResponse.json(driverWithDocs);
  } catch (error) {
    console.error("Error creating driver with documents:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
