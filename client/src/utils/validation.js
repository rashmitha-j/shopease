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

// Mirrors the rules in server/models/Product.js. Values are the form's strings.
const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
};

export function validateProduct({ name, brand, description, category, price, mrp, stock, imageUrl }) {
  const text = (value, label, max) => {
    const v = value.trim();
    if (!v) return `${label} is required`;
    if (v.length > max) return `${label} cannot exceed ${max} characters`;
    return undefined;
  };
  const priceNum = Number(price);
  const priceOk = price.trim() !== '' && Number.isFinite(priceNum) && priceNum >= 0;
  const mrpNum = Number(mrp);
  const stockNum = Number(stock);

  return withoutEmpty({
    name: text(name, 'Name', 120),
    brand: text(brand, 'Brand', 50),
    description: text(description, 'Description', 2000),
    category: category ? undefined : 'Choose a category',
    price: price.trim() === '' ? 'Price is required' : priceOk ? undefined : 'Enter a price of 0 or more',
    mrp:
      mrp.trim() === ''
        ? undefined
        : !Number.isFinite(mrpNum) || mrpNum < 0
          ? 'Enter an MRP of 0 or more, or leave it empty'
          : priceOk && mrpNum < priceNum
            ? 'MRP must be greater than or equal to the price'
            : undefined,
    stock:
      stock.trim() === ''
        ? 'Stock is required'
        : Number.isInteger(stockNum) && stockNum >= 0
          ? undefined
          : 'Stock must be a whole number of 0 or more',
    imageUrl: !imageUrl.trim()
      ? 'Image URL is required'
      : isHttpUrl(imageUrl)
        ? undefined
        : 'Enter a full URL starting with https:// or http://',
  });
}

// Mirrors server/models/Review.js
export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 1000;

export function validateReview({ rating, comment }) {
  const text = comment.trim();
  return withoutEmpty({
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? undefined : 'Choose a rating from 1 to 5 stars',
    comment: !text
      ? 'Write a few words about the product'
      : text.length < REVIEW_MIN_LENGTH
        ? `Your review must be at least ${REVIEW_MIN_LENGTH} characters`
        : text.length > REVIEW_MAX_LENGTH
          ? `Your review cannot exceed ${REVIEW_MAX_LENGTH} characters`
          : undefined,
  });
}
