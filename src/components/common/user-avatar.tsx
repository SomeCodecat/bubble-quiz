
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user?: {
    name?: string | null;
    username?: string | null;
    image?: string | null;
  } | null;
  src?: string | null;
  name?: string | null;
  fallback?: string | null; // Explicit fallback text
  className?: string;
}

export function UserAvatar({ user, src, name, fallback, className }: UserAvatarProps) {
  // Resolve image source
  const imageSrc = src || user?.image;

  // Resolve fallback text
  let fallbackText = "?";
  if (fallback) {
    fallbackText = fallback;
  } else if (name) {
    fallbackText = name.charAt(0).toUpperCase();
  } else if (user) {
    const n = user.name || user.username || "?";
    fallbackText = n.charAt(0).toUpperCase();
  }

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {imageSrc && (
        <AvatarImage 
            src={imageSrc} 
            alt={name || user?.name || "User Avatar"} 
            className="object-cover"
        />
      )}
      <AvatarFallback className="font-bold bg-muted text-muted-foreground">
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );
}
