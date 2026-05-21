import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Configuração inicial do Swagger
  const config = new DocumentBuilder()
    .setTitle('Fluxora API')
    .setDescription(
      'API do Fluxora para gestão financeira operacional, em evolução como produto próprio.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Inicialização do Swagger
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      docExpansion: 'none',
    },
  });

  const port = process.env.PORT ?? 3333;
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;

  console.log(`
    ===========================
      🚀  Fluxora API em execução  🚀
    ===========================
      Porta: ${port}
      API: ${baseUrl}
      📚 Documentação: ${baseUrl}/docs
    ===========================
    `);
}

void bootstrap();
