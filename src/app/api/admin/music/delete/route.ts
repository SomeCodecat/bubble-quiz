import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { filename } = await req.json();

    if (!filename) {
        return new NextResponse("Filename required", { status: 400 });
    }

    // Basic sanitization to prevent directory traversal
    const safeFilename = path.basename(filename); 
    const musicDir = path.join(process.cwd(), "public/background_music");
    const filepath = path.join(musicDir, safeFilename);

    if (existsSync(filepath)) {
      await unlink(filepath);
      return NextResponse.json({ success: true });
    } else {
        return new NextResponse("File not found", { status: 404 });
    }

  } catch (error) {
    console.error("Failed to delete music file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
