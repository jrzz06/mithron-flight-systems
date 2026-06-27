import { cn } from "@/lib/utils";

type AccountCardProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
};

export function AccountCard({ children, className, as: Tag = "div" }: AccountCardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface)] p-6 md:p-8",
        className
      )}
    >
      {children}
    </Tag>
  );
}
