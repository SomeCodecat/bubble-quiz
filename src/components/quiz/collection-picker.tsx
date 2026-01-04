"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Collection {
  id: string;
  name: string;
}

interface CollectionPickerProps {
  collections: Collection[];
  selectedCollectionIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function CollectionPicker({
  collections,
  selectedCollectionIds,
  onChange,
  className,
}: CollectionPickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedCount = selectedCollectionIds.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedCount > 0 ? (
            <div className="flex gap-1 flex-wrap">
              {selectedCount === 1 ? (
                <span className="truncate">
                  {
                    collections.find((c) => c.id === selectedCollectionIds[0])
                      ?.name
                  }
                </span>
              ) : (
                <span>{selectedCount} selected</span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Select collections...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search collections..." />
          <CommandList>
            <CommandEmpty>No collection found.</CommandEmpty>
            <CommandGroup>
              {collections.map((collection) => (
                <CommandItem
                  key={collection.id}
                  value={collection.name} // Search by Name
                  onSelect={(currentValue) => {
                    // currentValue is loosely matched, but we need ID.
                    // Actually onSelect gives the Value passed to CommandItem?
                    // Shadcn Command uses value prop for filtering.

                    const isSelected = selectedCollectionIds.includes(
                      collection.id
                    );
                    let newSelected;

                    if (isSelected) {
                      newSelected = selectedCollectionIds.filter(
                        (id) => id !== collection.id
                      );
                    } else {
                      newSelected = [...selectedCollectionIds, collection.id];
                    }
                    onChange(newSelected);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCollectionIds.includes(collection.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {collection.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
