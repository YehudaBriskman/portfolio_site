import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * The one select.
 *
 * A native `<select>` on purpose: the phone's own picker, type-ahead, form
 * semantics and screen-reader behaviour all come with it, and a custom
 * listbox would have to rebuild every one of them. What is ours is the skin
 * (`.a-select` in index.css): the inputs' height, radius, border and focus
 * ring, no platform arrow, and a chevron on the inline-end edge so it sits on
 * the left in Hebrew.
 *
 * `className` goes on the wrapper, because that is the box whose width a
 * caller means (`sm:w-48`); every other prop goes to the `<select>`.
 */
const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("a-select-wrap", className)}>
      <select ref={ref} className="a-select" {...props}>
        {children}
      </select>
      <ChevronDown className="a-select-chev" aria-hidden="true" />
    </div>
  ),
);
Select.displayName = "Select";

export default Select;
