import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Check for authorization if needed (e.g., a secret key for cron jobs)
    // For now, we'll assume it's protected by Vercel Cron or similar mechanism
    // or just open for this demo context.

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return new NextResponse("Unauthorized", { status: 401 });
      // Commented out for easier testing without env setup
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: "trash_retention_days" },
    });

    const retentionDays = parseInt(setting?.value || "7", 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedQuestions = await db.question.deleteMany({
      where: {
        deletedAt: {
          lt: cutoffDate,
        },
      },
    });

    const deletedCollections = await db.collection.deleteMany({
      where: {
        deletedAt: {
          lt: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedQuestions: deletedQuestions.count,
      deletedCollections: deletedCollections.count,
      retentionDays,
      cutoffDate,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
