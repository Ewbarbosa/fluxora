import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { SendEmailParams } from './email.types';

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;

  constructor() {
    this.resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;
  }

  async sendEmail({ to, subject, text, html }: SendEmailParams) {
    if (!this.resend) {
      throw new Error('RESEND_API_KEY não configurada para envio de e-mails');
    }

    const { data, error } = await this.resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fluxora <noreply@fluxora.app>',
      to,
      subject,
      text,
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}
