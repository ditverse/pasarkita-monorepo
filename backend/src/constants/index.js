const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  PAYMENT_FAILED: 'payment_failed',
  CANCELLED: 'cancelled',
});

const ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));

const PAID_STATUSES = new Set([
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
]);

const ROLE = Object.freeze({
  BUYER: 'buyer',
  SELLER: 'seller',
  SUPERADMIN: 'superadmin',
});

const ROLE_STATUS_POLICY = Object.freeze({
  [ROLE.SUPERADMIN]: [
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PAID,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.PAYMENT_FAILED,
    ORDER_STATUS.CANCELLED,
  ],
  [ROLE.BUYER]: [
    ORDER_STATUS.DELIVERED,
  ],
  [ROLE.SELLER]: [],
});

module.exports = {
  ORDER_STATUS,
  ORDER_STATUSES,
  PAID_STATUSES,
  ROLE,
  ROLE_STATUS_POLICY,
};
