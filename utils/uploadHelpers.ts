/**
 * Uploads a file using the storage API
 * @param file The file to upload
 * @param bucket The storage bucket to upload to
 * @param path Optional path within the bucket
 * @returns Promise with the upload result including the public URL
 */
export async function uploadFile(
  file: File,
  bucket: string,
  path?: string
): Promise<{
  success: boolean;
  publicUrl?: string;
  filePath?: string;
  error?: string;
}> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);

    if (path) {
      formData.append("path", path);
    }

    const response = await fetch("/api/storage", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Upload failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to upload file",
      };
    }

    return {
      success: true,
      publicUrl: result.publicUrl,
      filePath: result.filePath,
    };
  } catch (error) {
    console.error("Error in uploadFile:", error);
    return {
      success: false,
      error: "An unexpected error occurred during upload",
    };
  }
}

/**
 * Deletes a file from storage
 * @param bucket The storage bucket containing the file
 * @param path The path of the file within the bucket
 * @returns Promise with the deletion result
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `/api/storage?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Delete failed:", result.error);
      return {
        success: false,
        error: result.error || "Failed to delete file",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteFile:", error);
    return {
      success: false,
      error: "An unexpected error occurred during deletion",
    };
  }
}

/**
 * Generates a file path for document storage
 * @param driverId The ID of the driver
 * @param documentType The type of document (license, medical, mvr)
 * @param fileName The original file name
 * @returns The generated file path
 */
export function generateDocumentPath(
  driverId: string,
  documentType: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/\s+/g, "_");
  return `driver-documents/${documentType}/${driverId}_${Date.now()}_${sanitizedFileName}`;
}

/**
 * Extracts a file path from a Supabase storage URL
 * @param url The full Supabase URL
 * @param bucket The bucket name
 * @returns The file path within the bucket
 */
export function extractFilePathFromUrl(
  url: string,
  bucket: string
): string | null {
  try {
    // Find the bucket path in the URL
    const bucketPathIndex = url.indexOf(bucket);
    if (bucketPathIndex === -1) return null;

    // Extract everything after the bucket name
    const startIndex = bucketPathIndex + bucket.length + 1; // +1 for the slash
    return url.substring(startIndex);
  } catch (error) {
    console.error("Error extracting file path:", error);
    return null;
  }
}
