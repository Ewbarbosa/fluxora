import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class GoogleCalendarEncryptionService {
  private readonly logger = new Logger(GoogleCalendarEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64;

  /**
   * Obtém a chave de criptografia a partir da variável de ambiente
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.GOOGLE_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('GOOGLE_ENCRYPTION_KEY não configurada');
    }

    // Se a chave tem menos de 32 caracteres, fazer hash para garantir 32 bytes
    if (key.length < this.keyLength) {
      this.logger.warn('GOOGLE_ENCRYPTION_KEY muito curta, usando hash SHA256');
      return crypto.createHash('sha256').update(key).digest();
    }

    // Pegar os primeiros 32 bytes da chave
    return Buffer.from(key.substring(0, this.keyLength), 'utf8');
  }

  /**
   * Criptografa um token
   */
  encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Retornar: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Erro ao criptografar token: ${error.message}`);
      throw new Error('Falha ao criptografar token');
    }
  }

  /**
   * Descriptografa um token
   */
  decrypt(encryptedText: string): string {
    try {
      const key = this.getEncryptionKey();
      const parts = encryptedText.split(':');

      if (parts.length !== 3) {
        throw new Error('Formato de token criptografado inválido');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Erro ao descriptografar token: ${error.message}`);
      throw new Error('Falha ao descriptografar token');
    }
  }
}
