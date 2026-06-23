"use client";

import { ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProductPageReview, ProductReviewSummary } from "@/lib/product-reviews/types";
import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

type ReviewSort = "highest" | "newest";

function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn(styles.reviewStarRow, className)} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < rating ? styles.reviewStarFilled : styles.reviewStarEmpty} />
      ))}
    </div>
  );
}

function formatReviewDate(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function sortReviews(reviews: ProductPageReview[], sort: ReviewSort) {
  const next = [...reviews];
  if (sort === "highest") {
    next.sort((left, right) => right.rating - left.rating || (right.helpfulCount ?? 0) - (left.helpfulCount ?? 0));
    return next;
  }

  next.sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });
  return next;
}

function RatingDistribution({ summary }: { summary: ProductReviewSummary }) {
  const maxCount = Math.max(...Object.values(summary.distribution), 1);

  return (
    <div className={styles.reviewDistribution}>
      {([5, 4, 3, 2, 1] as const).map((stars) => {
        const count = summary.distribution[stars];
        const width = `${Math.max(6, Math.round((count / maxCount) * 100))}%`;
        return (
          <div key={stars} className={styles.reviewDistributionRow}>
            <span className={styles.reviewDistributionLabel}>{stars}</span>
            <div className={styles.reviewDistributionTrack}>
              <span className={styles.reviewDistributionFill} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProductReviewsSection({
  productName,
  reviews,
  summary
}: {
  productName: string;
  reviews: ProductPageReview[];
  summary: ProductReviewSummary;
}) {
  const [sort, setSort] = useState<ReviewSort>("highest");
  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  if (!reviews.length) return null;

  return (
    <section id="reviews" className={styles.reviewsSection} aria-labelledby="product-reviews-title">
      <div className={styles.reviewsInner}>
        <div className={styles.reviewsSummaryCard}>
          <div className={styles.reviewsSummaryMain}>
            <h2 id="product-reviews-title" className={styles.reviewsTitle}>
              Reviews
            </h2>
            <div className={styles.reviewsScoreBlock}>
              <p className={styles.reviewsScoreValue}>{summary.averageRating.toFixed(1)}</p>
              <StarRow rating={Math.round(summary.averageRating)} className={styles.reviewsScoreStars} />
              <p className={styles.reviewsScoreMeta}>
                {summary.totalReviews} review{summary.totalReviews === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <RatingDistribution summary={summary} />
        </div>

        <div className={styles.reviewsToolbar}>
          <p className={styles.reviewsCount}>
            {summary.totalReviews} review{summary.totalReviews === 1 ? "" : "s"}
          </p>
          <label className={styles.reviewsSortLabel}>
            <span className="sr-only">Sort reviews</span>
            <select
              className={styles.reviewsSortSelect}
              value={sort}
              onChange={(event) => setSort(event.target.value as ReviewSort)}
            >
              <option value="highest">Highest rating</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>

        <div className={styles.reviewList}>
          {sortedReviews.map((review) => {
            const reviewDate = formatReviewDate(review.createdAt);
            return (
              <article key={review.id} className={styles.reviewListItem}>
                <div className={styles.reviewListMeta}>
                  <StarRow rating={review.rating} />
                  <p className={styles.reviewAuthor}>{review.authorName}</p>
                  <p className={styles.reviewProductMeta}>{productName}</p>
                  {reviewDate ? <p className={styles.reviewDate}>{reviewDate}</p> : null}
                </div>
                <div className={styles.reviewListBody}>
                  {review.title ? <h3 className={styles.reviewItemTitle}>{review.title}</h3> : null}
                  <p className={styles.reviewItemBody}>{review.body}</p>
                  {review.helpfulCount ? (
                    <p className={styles.reviewHelpful}>
                      <ThumbsUp className="size-3.5" aria-hidden="true" />
                      <span>{review.helpfulCount}</span>
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
