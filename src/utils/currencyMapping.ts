export function formatCurrency(value: number) {
  // Format ke Rupiah
  return value.toLocaleString("id-ID", { style: "currency", currency: "IDR" });
}