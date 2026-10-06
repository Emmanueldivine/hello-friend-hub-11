/** Sends the student password reset code.
 *  Email sending from the owner's own domain is switched on once the domain
 *  is connected; until then the code is stored and this returns false. */
export async function sendResetCodeEmail(to: string, code: string): Promise<boolean> {
  const subject = "Your password reset code";
  try {
    const mod = (await import(/* @vite-ignore */ "@/lib/email-templates/send-email" as string).catch(() => null)) as
      | { sendTemplateEmail?: (t: string, to: string, o: unknown) => Promise<{ sent: boolean }> }
      | null;
    if (mod?.sendTemplateEmail) {
      const r = await mod.sendTemplateEmail("student-reset-code", to, { templateData: { code } });
      return r.sent;
    }
  } catch (e) {
    console.error("[reset-email] send failed", e);
  }
  console.warn(`[reset-email] email domain not connected yet; "${subject}" not sent to ${to.replace(/(.).+@/, "$1***@")}`);
  return false;
}
