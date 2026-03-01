import { Resend } from 'resend';

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is missing in environment.');
    process.exit(1);
  }

  const to = getArg('--to');
  if (!to) {
    console.error(
      'Missing recipient. Usage: pnpm --filter @ternity/api email:test -- --to your@email.com',
    );
    process.exit(1);
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const resend = new Resend(apiKey);

  const subject = `[Ternity] Resend setup test (${new Date().toISOString()})`;
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;padding:20px;color:#111;">
      <h2 style="margin:0 0 8px;">Ternity Email Test</h2>
      <p style="margin:0 0 8px;">Resend integration is working.</p>
      <p style="margin:0;font-size:12px;color:#555;">Sent at ${new Date().toISOString()}</p>
    </div>
  `;

  const response = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (response.error) {
    console.error('Resend error:', response.error);
    process.exit(1);
  }

  console.log('Email sent successfully.');
  console.log('Message ID:', response.data?.id ?? '(missing)');
  console.log('From:', from);
  console.log('To:', to);
}

main().catch((error) => {
  console.error('Email test failed:', error);
  process.exit(1);
});
