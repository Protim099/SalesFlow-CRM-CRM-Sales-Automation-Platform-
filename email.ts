import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export const emailMode = () => (process.env.SMTP_HOST ? "smtp" : "dev");

/** Sends via SMTP when configured; otherwise DEV MODE logs the message to the server console. */
export async function sendEmail(opts: { to: string; subject: string; text: string }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[email:dev-mode] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n`);
    return { mode: "dev" as const };
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({ from: process.env.EMAIL_FROM ?? "SalesFlow CRM <no-reply@localhost>", ...opts });
  return { mode: "smtp" as const };
}
