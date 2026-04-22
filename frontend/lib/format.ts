export function formatIDR(n: number | null | undefined): string {
  if (n == null) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
