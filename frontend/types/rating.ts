export type Rating = {
  id: string;
  rating: number;
  comment: string | null;
  image_urls: string[];
  date: string;
  buyer_name: string;
  seller_reply: string | null;
  seller_replied_at: string | null;
};

export type RatingSummary = {
  summary: {
    average: number;
    total: number;
    distribution: Record<string, number>;
  };
  reviews: Rating[];
};

export type SellerReview = {
  id: string;
  rating: number;
  comment: string | null;
  image_urls: string[];
  date: string;
  buyer_name: string;
  product_name: string;
  product_id: string;
  seller_reply: string | null;
  seller_replied_at: string | null;
};

export type SellerReviewsResponse = {
  reviews: SellerReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};
