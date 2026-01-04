import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET() {
  const musicDir = path.join(process.cwd(), "public/background_music");

  if (!existsSync(musicDir)) {
    return NextResponse.json([]);
  }

  try {
    const files = await readdir(musicDir);
    const musicFiles = files
        .filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
        .map(file => ({
            name: file,
            url: `/background_music/${file}`
        }));

    return NextResponse.json(musicFiles);
  } catch (error) {
    console.error("Failed to list music files:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
// This route is public so the MusicProvider can fetch the playlist for cycling.
