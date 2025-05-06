export const formatPhoneNumber = (value: string) => {
  // Remove all non-numeric characters
  const phoneNumber = value.replace(/\D/g, "");

  // Always try to format as (XXX) XXX-XXXX
  if (phoneNumber.length >= 10) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  }

  // Partial formatting as user types
  if (phoneNumber.length > 3) {
    if (phoneNumber.length > 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  if (phoneNumber.length > 0) {
    return `(${phoneNumber}`;
  }

  return phoneNumber;
};

export const normalizePhoneNumber = (value: string) => {
  return value.replace(/\D/g, "");
};

export const isValidPhoneNumber = (phoneNumber: string) => {
  const normalized = normalizePhoneNumber(phoneNumber);
  return normalized.length === 10;
};
