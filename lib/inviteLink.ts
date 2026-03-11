function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function randomRef(): string {
  // 5 digits, not cryptographic; good enough for lightweight attribution.
  return String(Math.floor(10000 + Math.random() * 90000));
}

export type DawnInviteLinkParams = {
  city: string;
  sunriseHHmm: string; // "HH:mm"
  dateYmd: string; // "YYYY-MM-DD" (local)
  ref?: string;
};

export function buildDawnInviteLink(params: DawnInviteLinkParams): string {
  const city = params.city.trim();
  const sunrise = params.sunriseHHmm.trim();
  const date = params.dateYmd.trim();
  const ref = (params.ref ?? randomRef()).trim();
  const qs = new URLSearchParams({
    city,
    sunrise,
    date,
    ref,
  });
  return `https://sunvantage.app/invite?${qs.toString()}`;
}

export function getTomorrowLocalYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalYmd(d);
}

