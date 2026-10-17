import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useCart } from '../cart/CartContext';
import { ErrorBox, Spinner } from '../components/ui';
import { PENDING_KEY, waitForCheckout } from '../utils/paymongo';

/**
 * Where the bank's 3-D Secure page sends the buyer back to. The order only exists once PayMongo's webhook confirms the
 * payment, so this page asks the API until the checkout is PAID (then shows the order) or FAILED.
 */
export function CheckoutReturnPage() {
  const navigate = useNavigate();
  const { afterPurchase } = useCart();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = sessionStorage.getItem(PENDING_KEY);
    if (!id) {
      navigate('/orders', { replace: true });
      return;
    }
    waitForCheckout(id, 60_000)
      .then((c) => {
        sessionStorage.removeItem(PENDING_KEY);
        if (c.status === 'PAID' && c.orderId) {
          afterPurchase();
          navigate(`/orders/${c.orderId}`, { replace: true, state: { justPurchased: true } });
        } else if (c.status === 'PENDING') {
          setProblem('Your payment is still being confirmed. Check My orders in a minute before paying again.');
        } else {
          setProblem(c.failureReason ?? 'The payment did not go through. You were not charged, or the amount will be refunded.');
        }
      })
      .catch((e) => setProblem(errorMessage(e)));
  }, [navigate, afterPurchase]);

  if (problem) {
    return (
      <>
        <h1>Payment</h1>
        <ErrorBox message={problem} />
        <p>
          <Link to="/cart">Back to your cart</Link> · <Link to="/orders">My orders</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1>Confirming your payment</h1>
      <Spinner />
      <p className="muted">This takes a few seconds. Please don&apos;t close this page.</p>
    </>
  );
}
