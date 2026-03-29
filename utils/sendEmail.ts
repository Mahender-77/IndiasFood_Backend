import nodemailer from "nodemailer";

type SendEmailParams = {
  subject: string;
  html: string;
  /** Defaults to ADMIN_EMAIL when omitted */
  to?: string;
};

export const sendEmail = async ({ subject, html, to }: SendEmailParams) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"India's Food" <${process.env.EMAIL_USER}>`,
    to: to ?? process.env.ADMIN_EMAIL,
    subject,
    html,
  });
};
