import nodemailer from "nodemailer";

export interface MailerConfig {
  gmailUser: string;
  gmailAppPassword: string;
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
    });

  sendApprovalRequestEmail = async (
    username: string,
    email: string,
  ): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: this.config.gmailUser,
      subject: "New User Approval Request",
      text: [
        `New signup request:`,
        `  Username: ${username}`,
        `  Email:    ${email}`,
        ``,
        `Review pending users: https://kawazplus.com/admin/users`,
      ].join("\n"),
    });
  };

  sendApprovalEmail = async (
    username: string,
    email: string,
  ): Promise<void> => {
    await this.transport.sendMail({
      from: this.config.gmailUser,
      to: email,
      subject: "Your Kawaz account has been approved",
      text: [
        `Hi ${username},`,
        ``,
        `Your account has been approved. You can now log in at https://kawazplus.com`,
        ``,
        `Welcome aboard!`,
      ].join("\n"),
    });
  };

  sendDenialEmail = async (
    username: string,
    email: string,
  ): Promise<void> => {
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
}
