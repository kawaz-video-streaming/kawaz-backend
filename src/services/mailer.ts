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
