import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type LassoToolbarButtonProps = {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

/** Renders an accessible icon button with its descriptive hover tooltip. */
export default function LassoToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: LassoToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex"
            aria-label={disabled ? label : undefined}
            tabIndex={disabled ? 0 : undefined}>
            <Button
              type="button"
              size="icon-sm"
              variant={active ? "default" : "ghost"}
              className={disabled ? "pointer-events-none" : undefined}
              aria-label={label}
              aria-pressed={active}
              disabled={disabled}
              onClick={onClick}>
              {children}
            </Button>
          </span>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
