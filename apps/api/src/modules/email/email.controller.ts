import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SendEmailDto } from './email.dto';

@ApiTags('Email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Envia um email' })
  async sendEmail(@Body() body: SendEmailDto) {
    return this.emailService.sendEmail({
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
  }
}
