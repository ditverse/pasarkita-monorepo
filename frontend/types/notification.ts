export type BuyerNotification = {
  id: string;
  order_id: string | null;
  type: 'order' | 'payment' | 'shipped' | 'rating' | 'system';
  title: string;
  message: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};
