import nodemailer from "nodemailer";

export interface MailerConfig {
  gmailUser: string;
  gmailAppPassword: string;
  appDomain: string;
}

export class Mailer {
  private transport: nodemailer.Transporter;
  constructor(private readonly config: MailerConfig) {
    this.transport = Mailer.createTransport(config);
  }

  private static createTransport = (config: MailerConfig) =>
    nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
      tls: { rejectUnauthorized: false },
    });

  sendApprovalRequestEmail = async (username: string, email: string): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: this.config.gmailUser,
      subject: "New User Approval Request",
      text: [
        `New signup request:`,
        `  Username: ${username}`,
        `  Email:    ${email}`,
        ``,
        `Review pending users: ${this.config.appDomain}`,
      ].join("\n"),
    });
  };

  sendApprovalEmail = async (username: string, email: string): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: email,
      subject: "Your Kawaz account has been approved",
      text: [
        `Hi ${username},`,
        ``,
        `Your account has been approved. You can now log in at ${this.config.appDomain}`,
        ``,
        `Welcome aboard!`,
      ].join("\n"),
    });
  };

  sendDenialEmail = async (username: string, email: string): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: email,
      subject: "Your Kawaz account request was not approved",
      text: [
        `Hi ${username},`,
        ``,
        `Unfortunately your account request has been denied.`,
        `If you believe this was a mistake, please contact us.`,
      ].join("\n"),
    });
  };

  sendNewsletter = async (subject: string, body: string, recipients: { name: string; email: string }[]): Promise<void> => {
    for (const recipient of recipients) {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#18181b;border-radius:12px;padding:32px;">
    <div style="font-size:28px;font-weight:900;color:#ffffff;margin-bottom:24px;letter-spacing:-1px;">
      Kawaz<span style="color:#ef4444;">+</span>
    </div>
    <div style="font-size:20px;font-weight:600;color:#ffffff;margin-bottom:16px;">${subject}</div>
    <div style="font-size:15px;color:#a1a1aa;line-height:1.7;">
      Hi ${recipient.name},<br><br>
      ${body.replace(/\n/g, '<br>')}
    </div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #27272a;font-size:12px;color:#52525b;">
      You're receiving this email because you have a Kawaz+ account.<br>
      <a href="${this.config.appDomain}" style="color:#ef4444;">${this.config.appDomain}</a>
    </div>
  </div>
</body>
</html>`;
      await this.transport.sendMail({
        from: this.config.gmailUser,
        to: recipient.email,
        subject,
        html,
      });
    }
  };

  sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: email,
      subject: "Password Reset Request - Kawaz Plus",
      text: [
        `Hi,`,
        ``,
        `You requested a password reset. You can reset your password at the following link:`,
        ` ${this.config.appDomain}/reset-password?token=${token}`,
        ``,
        `If you did not request this, please ignore this email.`,
      ].join("\n"),
    });
  };
}
