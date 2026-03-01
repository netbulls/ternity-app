import twilio from 'twilio';

export interface SendSmsInput {
  to: string;
  body: string;
}

let twilioClient: ReturnType<typeof twilio> | null = null;

function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured');
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

export async function sendSms(
  input: SendSmsInput,
): Promise<{ sid: string; status: string | null }> {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!messagingServiceSid) {
    throw new Error('TWILIO_MESSAGING_SERVICE_SID is not configured');
  }

  const client = getTwilioClient();
  const message = await client.messages.create({
    to: normalizePhoneNumber(input.to),
    body: input.body,
    messagingServiceSid,
  });

  return {
    sid: message.sid,
    status: message.status ?? null,
  };
}
