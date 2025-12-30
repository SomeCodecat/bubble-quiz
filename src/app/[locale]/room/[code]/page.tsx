import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import RoomClient from "./room-client";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: PageProps) {
  const { code } = await params;
  const session = await auth();

  // Fetch collections available to the user (Created by them OR Public/unlocked)
  // Actually, for simplicity, let's allow selecting from ALL unlocked collections + their own.
  const whereClause: any = {
    isLocked: false,
    deletedAt: null,
  };

  if (session?.user?.id) {
    whereClause.OR = [{ isLocked: false }, { creatorId: session.user.id }];
    delete whereClause.isLocked; // replaced by OR
    // Ensure deletedAt is still applied to the OR group or top level
    // Prisma AND/OR logic:
    // where: {
    //   AND: [
    //     { deletedAt: null },
    //     { OR: [{ isLocked: false }, { creatorId: ... }] }
    //   ]
    // }
    whereClause.AND = [{ deletedAt: null }];
    delete whereClause.deletedAt;
  }

  const collections = await db.collection.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      creator: {
        select: {
          name: true,
          username: true,
        },
      },
      _count: { select: { questions: true } },
    },
  });

  const tags = await db.tag.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { questions: true } },
    },
  });

  return (
    <RoomClient
      code={code}
      collections={collections}
      tags={tags}
      userId={session?.user?.id}
      userName={session?.user?.name || (session?.user as any)?.username}
      userAvatar={session?.user?.image || undefined}
    />
  );
}
