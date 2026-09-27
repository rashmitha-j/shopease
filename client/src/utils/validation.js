// Client-side checks that mirror the server's rules (server/models/User.js),
// so most mistakes are caught before a request is sent. The server still validates.

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 50;

const checkEmail = (email) => {
  if (!email.trim()) return 'Email is required';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return undefined;
};

// Each function returns { field: message } for the fields that have a problem
const withoutEmpty = (errors) => Object.fromEntries(Object.entries(errors).filter(([, msg]) => msg));

export function validateLogin({ email, password }) {
  return withoutEmpty({
    email: checkEmail(email),
    password: password ? undefined : 'Password is required',
  });
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const trimmedName = name.trim();
  return withoutEmpty({
    name: !trimmedName
      ? 'Name is required'
      : trimmedName.length > NAME_MAX_LENGTH
        ? `Name cannot exceed ${NAME_MAX_LENGTH} characters`
        : undefined,
    email: checkEmail(email),
    password: !password
      ? 'Password is required'
      : password.length < PASSWORD_MIN_LENGTH
        ? `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        : undefined,
    confirmPassword: password && confirmPassword !== password ? 'Passwords do not match' : undefined,
  });
}

// Mirrors the shipping address rules in server/models/Order.js
export const normalizePhone = (phone) =>
  String(phone).replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''); // "+91 98765-43210" -> "9876543210"

export function validateAddress({ fullName, phone, line1, line2 = '', city, state, postalCode }) {
  const required = (value, label, max) => {
    const v = value.trim();
    if (!v) return `${label} is required`;
    if (v.length > max) return `${label} cannot exceed ${max} characters`;
    return undefined;
  };
  return withoutEmpty({
    fullName: required(fullName, 'Full name', 60),
    phone: !phone.trim()
      ? 'Phone number is required'
      : /^[6-9]\d{9}$/.test(normalizePhone(phone))
        ? undefined
        : 'Enter a valid 10-digit mobile number',
    line1: required(line1, 'Address', 120),
    line2: line2.trim().length > 120 ? 'Address line 2 cannot exceed 120 characters' : undefined,
    city: required(city, 'City', 60),
    state: state ? undefined : 'Choose a state',
    postalCode: !postalCode.trim()
      ? 'PIN code is required'
      : /^[1-9]\d{5}$/.test(postalCode.trim())
        ? undefined
        : 'Enter a valid 6-digit PIN code',
  });
}
