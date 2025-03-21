import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";

async function ensureNotificationsBucket() {
  const supabase = createClient();

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const notificationsBucket = buckets.find((b) => b.name === "notifications");
    if (!notificationsBucket) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket(
        "notifications",
        {
          public: true, // Make the bucket public
          fileSizeLimit: 1024 * 1024 * 2, // 2MB limit
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
          ],
        }
      );

      if (createError) {
        throw new Error(
          `Failed to create notifications bucket: ${createError.message}`
        );
      }
    }
  } catch (error) {
    console.error(
      "Error ensuring notifications bucket:",
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function uploadNotificationImage(file: File) {
  try {
    const supabase = createClient();

    // Check authentication status
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError) {
      throw new Error(`Authentication error: ${authError.message}`);
    }
    if (!session) {
      throw new Error("User not authenticated");
    }

    // Ensure the bucket exists
    await ensureNotificationsBucket();

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds 2MB limit");
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "File type not allowed. Please upload a JPEG, PNG, GIF, or WebP image."
      );
    }

    // Create a unique file name
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log("Attempting to upload file:", {
      bucket: "notifications",
      filePath,
      fileType: file.type,
      fileSize: file.size,
      userId: session.user.id,
    });

    // Upload the file to Supabase storage
    const { data, error: uploadError } = await supabase.storage
      .from("notifications")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error details:", uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    if (!data) {
      throw new Error("Upload succeeded but no data was returned");
    }

    // Get the public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("notifications").getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error("Failed to get public URL for uploaded file");
    }

    return publicUrl;
  } catch (error) {
    console.error(
      "Error uploading image:",
      error instanceof Error ? error.message : "Unknown error",
      error
    );
    throw error;
  }
}
