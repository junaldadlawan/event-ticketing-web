import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { shareLinkApi } from '../api/endpoints';
import { Empty, Spinner } from '../components/ui';
import { rememberShareSource } from '../utils/shareSource';

/** A shared link (/s/code): counts the open, then goes to the event. Public, no login needed. */
export function ShareRedirectPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  // The poster's QR code carries ?src=qr; a pasted link does not.
  const source = useSearchParams()[0].get('src') === 'qr' ? 'QR' : 'LINK';
  const [missing, setMissing] = useState(false);
  // One open per visit: the guard keeps a re-render (or React's dev double run) from counting twice.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    shareLinkApi
      .open(code, source)
      .then(({ eventId }) => {
        rememberShareSource(eventId, source); // so a Buy now on that event is attributed
        navigate(`/events/${eventId}`, { replace: true });
      })
      .catch(() => setMissing(true));
  }, [code, navigate, source]);
  if (missing) {
    return (
      <Empty>
        This link is no longer available. <Link to="/events">See all events</Link>
      </Empty>
    );
  }
  return <Spinner />;
}
