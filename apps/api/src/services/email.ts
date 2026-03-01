import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null }> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@ternity.xyz';

  const response = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (response.error) {
    throw new Error(`Resend error: ${response.error.message}`);
  }

  return { id: response.data?.id ?? null };
}
