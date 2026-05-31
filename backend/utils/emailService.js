const nodemailer = require('nodemailer');

/**
 * Create reusable transporter using SMTP settings from .env
 */
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  // Check if email is configured
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email service not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: parseInt(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

/**
 * Send alert email notification
 * @param {Object} alert - The alert document
 * @param {Object} server - The server document
 * @param {Object} user - The user to notify
 * @returns {Promise<string>} 'sent' or 'failed'
 */
const sendAlertEmail = async (alert, server, user) => {
  try {
    const transport = getTransporter();
    if (!transport) {
      console.log('Email transport not configured. Skipping email for alert:', alert._id);
      return 'failed';
    }

    if (!user || !user.email) {
      console.log('No user email found. Skipping email for alert:', alert._id);
      return 'failed';
    }

    const severityLabel = alert.severity.toUpperCase();
    const subject = `[${severityLabel}] ${alert.type.toUpperCase()} Alert - ${server.name}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${alert.severity === 'Critical' ? '#F56C6C' : '#E6A23C'}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${alert.severity} Alert</h1>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e4e7ed; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #303133; margin-top: 0;">${alert.summary}</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266; width: 120px;">Server</td>
              <td style="padding: 8px 12px; color: #303133;">${server.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266;">Host</td>
              <td style="padding: 8px 12px; color: #303133;">${server.host}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266;">Metric</td>
              <td style="padding: 8px 12px; color: #303133;">${alert.type.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266;">Value</td>
              <td style="padding: 8px 12px; color: ${alert.severity === 'Critical' ? '#F56C6C' : '#E6A23C'}; font-weight: 700;">${alert.value}%</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266;">Threshold</td>
              <td style="padding: 8px 12px; color: #303133;">${alert.threshold}%</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; background: #f5f7fa; font-weight: 600; color: #606266;">Time</td>
              <td style="padding: 8px 12px; color: #303133;">${new Date(alert.triggerAt).toLocaleString()}</td>
            </tr>
          </table>
          
          <div style="background: #fef0f0; border-left: 4px solid #F56C6C; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <strong style="color: #303133;">Recommended Action:</strong>
            <p style="color: #606266; margin: 4px 0 0 0;">${alert.recommendedAction}</p>
          </div>
          
          ${alert.businessFunctions && alert.businessFunctions.length > 0 ? `
          <div style="margin-top: 16px;">
            <strong style="color: #606266; font-size: 12px;">AFFECTED BUSINESS FUNCTIONS</strong>
            <div style="margin-top: 4px;">
              ${alert.businessFunctions.map(fn => `<span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 2px;">${fn}</span>`).join(' ')}
            </div>
          </div>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #e4e7ed; margin: 20px 0;">
          <p style="color: #909399; font-size: 12px; text-align: center;">
            This is an automated alert from your Server Monitoring Dashboard.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Server Monitor" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html: htmlBody,
    };

    await transport.sendMail(mailOptions);
    console.log(`Alert email sent to ${user.email} for alert ${alert._id}`);
    return 'sent';
  } catch (err) {
    console.error('Failed to send alert email:', err.message);
    return 'failed';
  }
};

module.exports = { sendAlertEmail };
