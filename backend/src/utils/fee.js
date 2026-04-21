const FEE_PERCENTAGE = 0.02;

const calculateFee = (subtotal) => {
  const fee = Math.round(subtotal * FEE_PERCENTAGE);
  const total = subtotal + fee;
  return { subtotal, fee_marketplace: fee, total, fee_percentage: FEE_PERCENTAGE * 100 };
};

module.exports = { calculateFee };
