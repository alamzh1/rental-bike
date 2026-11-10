/**
 * Рейтинг в карточках: пока отзывов нет (они появятся на этапе 4), число не показываем,
 * а рейтинг подписан как демо — иначе выдумывали бы факт о бизнесе.
 */
export function ratingView(m: { rating: number | null; reviewsCount: number }): { show: boolean; showCount: boolean; demo: boolean } {
  if (m.rating === null) return { show: false, showCount: false, demo: false };
  const hasReviews = m.reviewsCount > 0;
  return { show: true, showCount: hasReviews, demo: !hasReviews };
}
