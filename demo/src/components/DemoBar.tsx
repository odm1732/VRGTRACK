import { useState } from "react";
import { Info, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemoData } from "@/demo/store";
import { cn } from "@/lib/utils";

/**
 * Persistent reminder that nothing here is real, plus an escape hatch back to
 * the seeded dataset after a viewer has clicked around and changed things.
 */
export default function DemoBar() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="fixed bottom-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-lg"
        aria-label="Show demo notice"
      >
        <Info className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-[min(22rem,calc(100vw-2rem))]",
        "rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"
      )}
    >
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Interactive demo.</span> Totals reflect
            the group's real numbers through Aug 19, 2026; the week-by-week breakdown is
            approximated from them. Edits are saved in this browser only — nothing is sent
            anywhere.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              resetDemoData();
              window.location.reload();
            }}
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Reset demo data
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Hide demo notice"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
