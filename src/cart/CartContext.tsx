import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { cartApi } from '../api/endpoints';
import type { Cart, CheckoutPayment, CheckoutStart, Order, UUID } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const CART_KEY = 'et.cartId';

interface CartState {
  cart: Cart | null;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (ticketTypeId: UUID, quantity: number) => Promise<void>;
  removeItem: (itemId: UUID) => Promise<void>;
  /** Changes how many tickets a line holds (the API keeps the hold's expiry). */
  setQuantity: (itemId: UUID, quantity: number) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => Promise<void>;
  /** Pays at once (an Order), or with PayMongo only starts the payment (a CheckoutStart: the order comes after the webhook). */
  checkout: (payment: CheckoutPayment, idempotencyKey: string, itemIds?: UUID[]) => Promise<Order | CheckoutStart>;
  /** An order exists: look at the cart again. If everything was paid it is gone; if only some items were, the rest are still there. */
  afterPurchase: () => void;
}

const CartContext = createContext<CartState | null>(null);

/**
 * The API has no "current cart" endpoint, so the cart id is remembered in
 * localStorage (per user) and a new cart is created lazily on first add.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const storageKey = user ? `${CART_KEY}.${user.id}` : null;

  const forget = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
    setCart(null);
  }, [storageKey]);

  const refresh = useCallback(async () => {
    const id = storageKey && localStorage.getItem(storageKey);
    if (!id) {
      setCart(null);
      return;
    }
    try {
      setCart(await cartApi.get(id));
    } catch (err) {
      // Cart was checked out, expired, or belongs to someone else.
      if (err instanceof ApiError && [403, 404, 410].includes(err.status)) forget();
      else throw err;
    }
  }, [storageKey, forget]);

  useEffect(() => {
    refresh().catch(() => setCart(null));
  }, [refresh]);

  const ensureCart = useCallback(async (): Promise<UUID> => {
    if (cart) return cart.id;
    const created = await cartApi.create();
    if (storageKey) localStorage.setItem(storageKey, created.id);
    setCart(created);
    return created.id;
  }, [cart, storageKey]);

  const addItem = useCallback(
    async (ticketTypeId: UUID, quantity: number) => {
      const id = await ensureCart();
      setCart(await cartApi.addItem(id, ticketTypeId, quantity));
    },
    [ensureCart],
  );

  const removeItem = useCallback(
    async (itemId: UUID) => {
      if (!cart) return;
      await cartApi.removeItem(cart.id, itemId);
      await refresh();
    },
    [cart, refresh],
  );

  const setQuantity = useCallback(
    async (itemId: UUID, quantity: number) => {
      if (cart) setCart(await cartApi.setQuantity(cart.id, itemId, quantity));
    },
    [cart],
  );

  const applyPromo = useCallback(
    async (code: string) => {
      if (cart) setCart(await cartApi.applyPromo(cart.id, code));
    },
    [cart],
  );

  const removePromo = useCallback(async () => {
    if (cart) setCart(await cartApi.removePromo(cart.id));
  }, [cart]);

  const checkout = useCallback(
    async (payment: CheckoutPayment, idempotencyKey: string, itemIds?: UUID[]) => {
      if (!cart) throw new Error('Your cart is empty');
      let result: Order | CheckoutStart;
      try {
        result = await cartApi.checkout(cart.id, payment, idempotencyKey, itemIds);
      } catch (err) {
        // A promo code paused or deleted after it was applied stays on the cart but is no longer shown, so the
        // buyer can't see or remove it, yet checkout refuses it (422). It gives no discount any more, so the price
        // is unchanged: detach it and try once more. Nothing was charged, so the same idempotency key is safe.
        const hiddenDeadPromo =
          err instanceof ApiError && err.status === 422 && !cart.appliedPromoCode && /promo code/i.test(err.problem?.detail ?? '');
        if (!hiddenDeadPromo) throw err;
        await cartApi.removePromo(cart.id);
        result = await cartApi.checkout(cart.id, payment, idempotencyKey, itemIds);
      }
      // An order spends the paid items. A started PayMongo payment keeps the cart until it is paid.
      if (!('checkoutId' in result)) await refresh().catch(() => forget());
      return result;
    },
    [cart, forget, refresh],
  );

  const afterPurchase = useCallback(() => {
    void refresh().catch(() => forget());
  }, [refresh, forget]);

  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  const value = useMemo(
    () => ({ cart, itemCount, refresh, addItem, removeItem, setQuantity, applyPromo, removePromo, checkout, afterPurchase }),
    [cart, itemCount, refresh, addItem, removeItem, setQuantity, applyPromo, removePromo, checkout, afterPurchase],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
