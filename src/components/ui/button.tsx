import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-forest-800 text-ivory hover:bg-forest-900",
        secondary: "bg-sage-200 text-forest-900 hover:bg-sage-300",
        outline: "border border-forest-800/30 text-forest-900 hover:bg-forest-800/5",
        ghost: "text-forest-900 hover:bg-forest-800/5",
        light: "bg-ivory text-forest-900 hover:bg-white",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type StyleProps = VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  href,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & StyleProps & { href: string }) {
  return <Link href={href} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
