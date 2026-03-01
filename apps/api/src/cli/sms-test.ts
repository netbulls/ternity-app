import twilio from 'twilio';

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.error(
      'Missing Twilio env vars. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID.',
    );
    process.exit(1);
  }

  const to = getArg('--to');
  if (!to) {
    console.error(
      'Missing recipient. Usage: pnpm --filter @ternity/api sms:test -- --to +48123456789',
    );
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);
  const body = `Ternity SMS test (${new Date().toISOString()})`;

  const result = await client.messages.create({
    to,
    body,
    messagingServiceSid,
  });

  console.log('SMS sent successfully.');
  console.log('Message SID:', result.sid);
  console.log('Status:', result.status);
  console.log('To:', to);
}

main().catch((error) => {
  console.error('SMS test failed:', error);
  process.exit(1);
});
