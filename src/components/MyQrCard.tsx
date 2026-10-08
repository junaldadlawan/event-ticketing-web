import { useEffect, useState } from 'react';
import { userQrDataUrl } from '../utils/userQr';

/**
 * "My QR": the user's transfer QR code. Someone who wants to send them a ticket uploads this picture on the
 * transfer form instead of typing the user ID. Shows the code, with a Download button.
 */
export function MyQrCard({ userId, name }: { userId: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    userQrDataUrl(userId).then((url) => alive && setSrc(url)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <section className="card my-qr">
      <h2>My QR</h2>
      <p className="muted small">
        Show or send this picture to someone who wants to transfer a ticket to you. They upload it on the
        transfer form and your account is filled in for them.
      </p>
      {src ? (
        <div className="my-qr-body">
          <img src={src} alt={`Transfer QR code for ${name}`} width={200} height={200} />
          <a className="btn btn-sm" href={src} download="my-ticket-transfer-qr.png">
            Download QR
          </a>
        </div>
      ) : (
        <p className="muted small">Making your QR code…</p>
      )}
    </section>
  );
}
