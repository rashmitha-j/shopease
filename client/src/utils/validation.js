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
