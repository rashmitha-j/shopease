const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

let loading = null;

// Loads Razorpay's Checkout script the first time it is needed (not on every page)
// and resolves with the global `Razorpay` constructor.
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load'));
    script.onerror = () => {
      script.remove();
      loading = null; // allow a retry later
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return loading;
}
