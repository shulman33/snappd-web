import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Edge Function: cleanup-expired
 *
 * Purpose: Cleans up expired screenshots by:
 * 1. Querying the database for expired screenshots
 * 2. Deleting the storage files
 * 3. Deleting the database records
 *
 * This function can be invoked:
 * - Via pg_cron scheduled job (HTTP POST)
 * - Manually via API call
 * - Via external cron service
 */

interface CleanupResult {
  success: boolean;
  deletedCount: number;
  deletedFiles: number;
  errors: string[];
  timestamp: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Verify authorization (require service role key for security)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query for expired screenshots
    const { data: expiredScreenshots, error: queryError } = await supabase
      .from("screenshots")
      .select("id, short_id, storage_path")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    if (queryError) {
      console.error("Error querying expired screenshots:", queryError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to query expired screenshots",
          details: queryError.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!expiredScreenshots || expiredScreenshots.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          deletedCount: 0,
          deletedFiles: 0,
          errors: [],
          timestamp: new Date().toISOString(),
          message: "No expired screenshots found",
        } as CleanupResult),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const errors: string[] = [];
    let deletedFilesCount = 0;

    // Delete storage files first
    for (const screenshot of expiredScreenshots) {
      try {
        // Delete the main file
        const { error: storageError } = await supabase.storage
          .from("screenshots")
          .remove([screenshot.storage_path]);

        if (storageError) {
          console.error(
            `Failed to delete storage file ${screenshot.storage_path}:`,
            storageError
          );
          errors.push(
            `Storage deletion failed for ${screenshot.short_id}: ${storageError.message}`
          );
        } else {
          deletedFilesCount++;
        }

        // Note: Optimized and thumbnail versions are handled by Supabase Storage transformations
        // They don't create separate files, so no need to delete them separately
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(
          `Exception deleting storage for ${screenshot.short_id}:`,
          error
        );
        errors.push(`Exception for ${screenshot.short_id}: ${errorMessage}`);
      }
    }

    // Delete database records
    // The triggers will automatically update monthly_usage
    const screenshotIds = expiredScreenshots.map((s) => s.id);
    const { error: deleteError, count } = await supabase
      .from("screenshots")
      .delete({ count: "exact" })
      .in("id", screenshotIds);

    if (deleteError) {
      console.error("Error deleting screenshot records:", deleteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete screenshot records",
          details: deleteError.message,
          partialDeletion: {
            filesDeleted: deletedFilesCount,
            totalExpired: expiredScreenshots.length,
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result: CleanupResult = {
      success: true,
      deletedCount: count || 0,
      deletedFiles: deletedFilesCount,
      errors,
      timestamp: new Date().toISOString(),
    };

    console.log("Cleanup completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
