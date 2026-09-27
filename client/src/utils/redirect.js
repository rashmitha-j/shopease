// Where to send the user after logging in or signing up.
// Links to /login pass the current page as `state.from`. Only same-site paths are
// accepted, so a crafted link can't redirect someone to another website.
export function getRedirectPath(location) {
  const from = location.state?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
