import { Order } from '@/types/api';

const BUDGET_KEY_PREFIX = 'pk-weekly-budget:';
const COUNTED_ORDER_STATUSES = new Set<Order['status']>(['paid', 'processing', 'shipped', 'delivered']);

export function getWeeklyBudget(userId: string): number | null {
  if (typeof window === 'undefined') return null;

  const value = Number(window.localStorage.getItem(`${BUDGET_KEY_PREFIX}${userId}`));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function saveWeeklyBudget(userId: string, amount: number | null): void {
  if (typeof window === 'undefined') return;

  const key = `${BUDGET_KEY_PREFIX}${userId}`;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, String(Math.round(amount)));
}

export function getCurrentWeekRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

export function calculateWeeklySpending(orders: Order[], now = new Date()): number {
  const { start, end } = getCurrentWeekRange(now);

  return orders.reduce((total, order) => {
    const createdAt = new Date(order.created_at);
    if (
      !COUNTED_ORDER_STATUSES.has(order.status) ||
      Number.isNaN(createdAt.getTime()) ||
      createdAt < start ||
      createdAt >= end
    ) {
      return total;
    }

    return total + Number(order.total || 0);
  }, 0);
}
