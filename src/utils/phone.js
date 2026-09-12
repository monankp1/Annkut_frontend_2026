// One definition of the phone rule for the whole app: exactly ten digits,
// nothing else. Typing is filtered so a non-digit never lands in state, and
// the length is checked again on submit so a half-typed number cannot be
// saved.

export const PHONE_LENGTH = 10;

/** What an onChange should store: digits only, never longer than ten. */
export const cleanPhone = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, PHONE_LENGTH);

export const isCompletePhone = (value) =>
  cleanPhone(value).length === PHONE_LENGTH;

/** True once the field has something in it but not yet a whole number. */
export const isPartialPhone = (value) => {
  const v = cleanPhone(value);
  return v.length > 0 && v.length < PHONE_LENGTH;
};

export const PHONE_ERROR = `Phone number must be exactly ${PHONE_LENGTH} digits.`;

// The seva forms speak Gujarati to the sevaks filling them in.
export const PHONE_ERROR_GU = `ફોન નંબર ${PHONE_LENGTH} અંકનો હોવો જોઈએ`;

/** Props every phone input shares — numeric keypad on mobile, hard cap. */
export const phoneInputProps = {
  inputMode: "numeric",
  pattern: "[0-9]*",
  maxLength: PHONE_LENGTH,
};
