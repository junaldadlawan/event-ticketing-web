import { useLocation, useNavigate } from 'react-router-dom';

/** Where "back" goes when there is no in-app history (direct link, refresh, new tab). */
function parentPath(pathname: string): string {
  if (pathname.startsWith('/orders/')) return '/orders';
  if (pathname.startsWith('/manage/')) return '/manage';
  return '/';
}

export function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/') return null;

  function goBack() {
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
