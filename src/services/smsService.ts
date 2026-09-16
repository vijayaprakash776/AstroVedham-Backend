/**
 * SMS Service abstraction for AstroVedham
 */
export interface ISmsProvider {
  sendOtp(phone: string, otp: string): Promise<boolean>;
}

class DevelopmentSmsProvider implements ISmsProvider {
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    console.log(`[SMS DEV PROVIDER] Sending OTP ${otp} to phone ${phone}`);
    return true;
  }
}

class ProductionSmsProvider implements ISmsProvider {
  async sendOtp(phone: string, otp: string): Promise<boolean> {
    // Infrastructure TODO: Configure real production SMS gateway provider (e.g., Twilio, Msg91, etc.)
    console.warn(`[SMS PROD PROVIDER] Production SMS gateway is not configured yet. Logging OTP: ${otp}`);
    return true;
  }
}

const isProduction = process.env.NODE_ENV === 'production';
export const smsService: ISmsProvider = isProduction
  ? new ProductionSmsProvider()
  : new DevelopmentSmsProvider();
