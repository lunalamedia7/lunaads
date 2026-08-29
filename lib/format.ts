const LOCALE_BY_CURRENCY: Record<string, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  CLP: "es-CL",
};

export function formatCurrency(value: number, currency: string): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
