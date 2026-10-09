import { useLocation, useNavigate } from 'react-router-dom';
import { useUnsavedChangesApi } from './UnsavedChanges';

/** Where "back" goes when there is no in-app history (direct link, refresh, new tab). */
function parentPath(pathname: string): string {
  if (pathname.startsWith('/orders/')) return '/orders';
  const design = pathname.match(/^\/manage\/events\/([^/]+)\/ticket-design$/);
  if (design) return `/manage/events/${design[1]}`;
  if (pathname.startsWith('/manage/')) return '/manage';
  return '/';
}

export function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirmLeave } = useUnsavedChangesApi();

  // The top-level tabs (Home, Events, Manage) and the login and sign-up pages have nowhere to go back to. They line up with each other, so
  // no placeholder is needed.
  if (['/', '/home', '/manage', '/manage/team', '/login', '/register', '/admin/posts', '/admin/organizations', '/admin/users', '/admin/payouts'].includes(location.pathname)) return null;

  async function goBack() {
    // Unsaved edits on this page? Ask "Discard or continue editing" first.
    if (!(await confirmLeave())) return;
    // React Router gives the very first entry of a session the key "default",
    // so anything else means there is an in-app page to go back to.
    if (location.key !== 'default') navigate(-1);
    else navigate(parentPath(location.pathname));
  }

  return (
    <button type="button" className="back-button" onClick={goBack}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
