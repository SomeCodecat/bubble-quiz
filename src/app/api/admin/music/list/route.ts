import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const musicDir = path.join(process.cwd(), "public/background_music");

  if (!existsSync(musicDir)) {
    return NextResponse.json([]);
  }

  try {
    const files = await readdir(musicDir);
    // Filter for common audio extensions if needed, or just return all
    const musicFiles = files.filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f));
    
    // Map to a structure useful for the frontend
    const fileList = musicFiles.map(file => ({
      name: file,
      url: `/background_music/${file}`
    }));

    return NextResponse.json(fileList);
  } catch (error) {
    console.error("Failed to list music files:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
