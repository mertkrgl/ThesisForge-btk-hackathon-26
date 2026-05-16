import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className,
  as: As = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p";
}) {
  return <As className={cn("tf-gradient-text", className)}>{children}</As>;
}
