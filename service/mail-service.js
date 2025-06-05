import nodemailer from "nodemailer";

class MailService {
  constructor() {
    console.log({ SMTP_PASSWORD: process.env.SMTP_PASSWORD });
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendActivationMail(to, link) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: `Активация аккаунта в приложении "Семейный Бюджет" ${process.env.API_URL}`,
        text: "",
        html: `
      <div>
        <h1>Для активации перейдите по ссылке</h1>
        <a href="${link}">${link}</a>
      </div>
      `,
      });

      return "ok";
    } catch (e) {
      console.log("ERROR_SEND_MAIL", e);
    }
  }
}

export const mailService = new MailService();
