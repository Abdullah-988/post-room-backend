import nodemailer from "nodemailer";

type sendMailProps = {
  subject: string;
  email: string;
  html: string;
};

export async function sendMail({ subject, email, html }: sendMailProps) {
  const transporter = nodemailer.createTransport({
    service: process.env.NODEMAILER_SERVICE,
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  });

  const mailOptions = {
    from: `Post Room <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: subject,
    html: html,
  };

  await new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err: any, response: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}
