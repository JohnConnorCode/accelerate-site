import { Resend } from "resend";
import { adminEmail, fromEmail } from "@/config/tenant";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return _resend;
}

export const FROM_EMAIL = fromEmail();
export const ADMIN_EMAIL = adminEmail();
