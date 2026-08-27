/**
 * Bangladesh Phone Number Validation and Formatter Utility
 */

export interface PhoneValidationResult {
  isValid: boolean;
  raw: string;
  formatted: string; // Standard 11-digit format: 01XXXXXXXXX
  withCountryCode: string; // 8801XXXXXXXXX
  plusCountryCode: string; // +8801XXXXXXXXX
  operator?: string;
  error?: string;
}

/**
 * Validates and formats a Bangladeshi mobile number.
 * Supports:
 * - 017XXXXXXXX
 * - 88017XXXXXXXX
 * - +88017XXXXXXXX
 * - Numbers with spaces, dashes, or parentheses
 */
export function formatBdPhoneNumber(input: string | number): PhoneValidationResult {
  if (!input) {
    return {
      isValid: false,
      raw: '',
      formatted: '',
      withCountryCode: '',
      plusCountryCode: '',
      error: 'ফোন নম্বর প্রদান করা হয়নি।'
    };
  }

  // Convert to string and sanitize (remove non-digit characters except leading +)
  let raw = String(input).trim();
  let sanitized = raw.replace(/[\s\-\(\)\.]/g, '');

  // Convert Bengali numerals to English numerals if any
  const banglaDigits: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  sanitized = sanitized.replace(/[০-৯]/g, (d) => banglaDigits[d] || d);

  // Remove leading +880 or 880 or +88 or 88
  if (sanitized.startsWith('+880')) {
    sanitized = '0' + sanitized.substring(4);
  } else if (sanitized.startsWith('880')) {
    sanitized = '0' + sanitized.substring(3);
  } else if (sanitized.startsWith('+88')) {
    sanitized = sanitized.substring(3);
    if (!sanitized.startsWith('0')) sanitized = '0' + sanitized;
  }

  // Check if starts with 01 and has 11 digits
  // BD Mobile regex: ^01[3-9]\d{8}$
  const bdMobileRegex = /^01[3-9]\d{8}$/;
  const isValid = bdMobileRegex.test(sanitized);

  if (!isValid) {
    return {
      isValid: false,
      raw,
      formatted: sanitized,
      withCountryCode: sanitized.startsWith('0') ? `88${sanitized}` : `880${sanitized}`,
      plusCountryCode: sanitized.startsWith('0') ? `+88${sanitized}` : `+880${sanitized}`,
      error: 'অকার্যকর বাংলাদেশী মোবাইল নম্বর। ১১ ডিজিটের সঠিক নম্বর দিন (যেমন: 017XXXXXXXX).'
    };
  }

  // Determine operator prefix
  const prefix = sanitized.substring(0, 3);
  let operator = 'Other';
  if (prefix === '017' || prefix === '013') operator = 'Grameenphone';
  else if (prefix === '018') operator = 'Robi';
  else if (prefix === '019' || prefix === '014') operator = 'Banglalink';
  else if (prefix === '015') operator = 'Teletalk';
  else if (prefix === '016') operator = 'Airtel';

  return {
    isValid: true,
    raw,
    formatted: sanitized,
    withCountryCode: `88${sanitized}`,
    plusCountryCode: `+88${sanitized}`,
    operator
  };
}
