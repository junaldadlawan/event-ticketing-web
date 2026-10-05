import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { cartApi } from '../api/endpoints';
import type { Cart, Order, UUID } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const CART_KEY = 'et.cartId';

interface CartState {
  cart: Cart | null;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (ticketTypeId: UUID, quantity: number) => Promise<void>;
  removeItem: (itemId: UUID) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => Promise<void>;
  checkout: (paymentMethodToken: string, idempotencyKey: string) => Promise<Order>;
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
    async (paymentMethodToken: string, idempotencyKey: string) => {
      if (!cart) throw new Error('Your cart is empty');
      const order = await cartApi.checkout(cart.id, paymentMethodToken, idempotencyKey);
      forget();
      return order;
    },
    [cart, forget],
  );

  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  const value = useMemo(
    () => ({ cart, itemCount, refresh, addItem, removeItem, applyPromo, removePromo, checkout }),
    [cart, itemCount, refresh, addItem, removeItem, applyPromo, removePromo, checkout],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
