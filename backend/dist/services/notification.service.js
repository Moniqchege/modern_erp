"use strict";
/**
 * Email notifications — logs to console when SMTP is not configured.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.getInventoryAlertRecipients = getInventoryAlertRecipients;
function getAlertRecipients() {
    const raw = process.env.INVENTORY_ALERT_EMAILS ?? process.env.DEFAULT_ADMIN_EMAIL ?? "";
    return raw
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes("@"));
}
async function sendEmail(params) {
    const recipients = params.to.length > 0 ? params.to : getAlertRecipients();
    if (recipients.length === 0) {
        console.warn("[email] No recipients configured. Set INVENTORY_ALERT_EMAILS.");
        console.log(`[email] ${params.subject}\n${params.text}`);
        return false;
    }
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user ?? "erp@localhost";
    if (!host || !port) {
        console.log(`[email] → ${recipients.join(", ")} | ${params.subject}`);
        console.log(params.text);
        return true;
    }
    try {
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: user && pass ? { user, pass } : undefined,
        });
        await transport.sendMail({
            from,
            to: recipients.join(", "),
            subject: params.subject,
            text: params.text,
            html: params.html ?? params.text.replace(/\n/g, "<br>"),
        });
        return true;
    }
    catch (err) {
        console.error("[email] send failed:", err);
        console.log(`[email] fallback log: ${params.subject}\n${params.text}`);
        return false;
    }
}
function getInventoryAlertRecipients() {
    return getAlertRecipients();
}
