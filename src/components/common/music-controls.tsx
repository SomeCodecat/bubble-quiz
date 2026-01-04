"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMusic } from "@/components/providers/music-provider";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MusicControlsProps {
    className?: string; // Additional classes for positioning/styling
    variant?: "minimal" | "full"; // Minimal just icons, full might include text?
}

export function MusicControls({ className, variant = "minimal" }: MusicControlsProps) {
    const { isPlaying, isMuted, volume, togglePlay, toggleMute, setVolume } = useMusic();

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                title={isPlaying ? "Pause Music" : "Play Music"}
                className="h-8 w-8"
            >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </Button>
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 relative" title="Volume">
                         {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2" side="top">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Volume</span>
                            <span>{Math.round(volume * 100)}%</span>
                        </div>
                        <Slider 
                            value={[isMuted ? 0 : volume]} 
                            max={1} 
                            step={0.05}
                            onValueChange={(val) => setVolume(val[0])}
                        />
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-6 text-xs w-full mt-1"
                            onClick={toggleMute}
                        >
                            {isMuted ? "Unmute" : "Mute"}
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
