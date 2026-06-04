import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }>) {
  return (
    <button className={clsx("button", `button-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}
