import { env } from '../env.js';
import type { EmailProvider } from '../types/index.js';
import { smtpProvider } from './smtp.provider.js';
import { emailjsProvider } from './emailjs.provider.js';

export function getProvider(): EmailProvider {
  return env.EMAIL_PROVIDER === 'emailjs' ? emailjsProvider : smtpProvider;
}
