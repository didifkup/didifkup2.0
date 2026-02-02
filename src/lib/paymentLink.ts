const PAYMENT_LINK_URL = import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL as string | undefined;

export function openPaymentLink(): void {
  const url = PAYMENT_LINK_URL?.trim();
  if (url) {
    window.location.href = url;
  }
}
