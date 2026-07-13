/**
 * Standalone SMTP test — checks that your EMAIL_* .env settings actually work.
 *
 *   node backend/scripts/test-email.js                 # sends a test mail to EMAIL_USER
 *   TEST_TO=someone@example.com node backend/scripts/test-email.js
 *
 * Exit 0 = connection verified and test email sent. Exit 1 = misconfigured.
 * Uses the same transport settings as utils/emailService.js.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

async function main() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.error('MISSING config. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in backend/.env');
    console.error(`  EMAIL_HOST=${EMAIL_HOST || '(empty)'}`);
    console.error(`  EMAIL_USER=${EMAIL_USER || '(empty)'}`);
    console.error(`  EMAIL_PASS=${EMAIL_PASS ? '(set)' : '(empty)'}`);
    process.exit(1);
  }

  const port = parseInt(EMAIL_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  console.log(`Connecting to ${EMAIL_HOST}:${port} as ${EMAIL_USER} ...`);
  await transporter.verify();
  console.log('SMTP connection + auth OK.');

  const to = process.env.TEST_TO || EMAIL_USER;
  const info = await transporter.sendMail({
    from: EMAIL_USER,
    to,
    subject: 'Server Monitor — SMTP test',
    text: 'If you can read this, your EMAIL_* settings work. Alert emails will send.',
  });

  console.log(`Test email sent to ${to}. messageId: ${info.messageId}`);
  console.log('SUCCESS');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  if (/Invalid login|Username and Password not accepted|BadCredentials/i.test(err.message)) {
    console.error('>> Gmail: use a 16-char App Password (2-Step Verification required), NOT your account password.');
  }
  process.exit(1);
});
