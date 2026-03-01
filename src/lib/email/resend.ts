import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "Accelerate <hello@acceleratewith.us>";
export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "hello@acceleratewith.us";
