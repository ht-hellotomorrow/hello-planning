import {
  type Category,
  CATEGORY_BADGE_CLASS,
  CATEGORY_LABEL,
} from "@/lib/categories";

type Props = {
  category: Category;
  className?: string;
};

export function CategoryBadge({ category, className = "" }: Props) {
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold shrink-0 ${CATEGORY_BADGE_CLASS[category]} ${className}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
