import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, BookOpen, Code2, Hash } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DOCS_SEARCH_DATA, type DocsSearchItem } from "@/lib/docs-search-data";

const TYPE_ICON: Record<DocsSearchItem["type"], typeof BookOpen> = {
  guide: BookOpen,
  api: Code2,
  section: Hash,
};

const TYPE_LABEL: Record<DocsSearchItem["type"], string> = {
  guide: "Guides",
  api: "API Reference",
  section: "Sections",
};

export function DocsSearchCommand() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const nav = useNavigate();

  const grouped = React.useMemo(() => {
    const groups: Record<DocsSearchItem["type"], DocsSearchItem[]> = {
      guide: [],
      api: [],
      section: [],
    };
    for (const item of DOCS_SEARCH_DATA) {
      groups[item.type].push(item);
    }
    return groups;
  }, []);

  function handleSelect(item: DocsSearchItem) {
    setOpen(false);
    setQuery("");

    if (item.params) {
      nav({
        to: item.href as "/docs/$slug",
        params: item.params as { slug: string },
        hash: item.hash,
      });
    } else {
      nav({
        to: item.href as "/docs" | "/docs/api-reference",
        hash: item.hash,
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative mx-auto max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm text-muted-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring items-center"
          >
            Search the docs...
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search the docs..."
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No results found.</CommandEmpty>
            {(["guide", "api", "section"] as const).map((type) => {
              const items = grouped[type];
              if (items.length === 0) return null;
              return (
                <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                  {items.map((item) => {
                    const Icon = TYPE_ICON[item.type];
                    return (
                      <CommandItem
                        key={`${item.type}-${item.title}`}
                        value={`${item.title} ${item.description} ${item.keywords}`}
                        onSelect={() => handleSelect(item)}
                      >
                        <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate text-sm">{item.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
