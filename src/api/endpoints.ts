import { api } from './client';
import type {
  Cart,
  Event,
  EventCreateRequest,
  EventStatus,
  EventUpdateRequest,
  Order,
  PageResponse,
  Ticket,
  TicketType,
  TicketTypeCreateRequest,
  TokenPair,
  User,
  UUID,
  Venue,
} from './types';

export interface PageQuery {
  page?: number;
  size?: number;
  sort?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<TokenPair>('/auth/login', { method: 'POST', body: { email, password } }),
  // The register DTO names the plaintext password field `passwordHash`
  // (the server hashes it) and requires a role.
  register: (name: string, email: string, password: string) =>
    api<User>('/auth/register', {
      method: 'POST',
      body: { name, email, passwordHash: password, role: 'CUSTOMER' },
    }),
  logout: (refreshToken: string) =>
    api<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
};

export const userApi = {
  me: () => api<User>('/users/me'),
  updateMe: (body: { name?: string; email?: string }) =>
    api<User>('/users/me', { method: 'PATCH', body }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<User>('/users/me/change-password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    }),
};

export interface EventSearch extends PageQuery {
  keyword?: string;
  category?: string;
  startsAfter?: string;
  startsBefore?: string;
}

export interface ManagedEventSearch extends EventSearch {
  status?: EventStatus;
  organizationId?: UUID;
}

export const eventApi = {
  search: (q: EventSearch) => api<PageResponse<Event>>('/events', { query: { ...q } }),
  managed: (q: ManagedEventSearch) =>
    api<PageResponse<Event>>('/events/managed', { query: { ...q } }),
  get: (id: UUID) => api<Event>(`/events/${id}`),
  create: (body: EventCreateRequest) => api<Event>('/events', { method: 'POST', body }),
  update: (id: UUID, body: EventUpdateRequest) =>
    api<Event>(`/events/${id}`, { method: 'PATCH', body }),
  publish: (id: UUID) => api<Event>(`/events/${id}/publish`, { method: 'POST' }),
  cancel: (id: UUID) => api<Event>(`/events/${id}/cancel`, { method: 'POST' }),
  remove: (id: UUID) => api<void>(`/events/${id}`, { method: 'DELETE' }),
  orders: (id: UUID, q: PageQuery = {}) =>
    api<PageResponse<Order>>(`/events/${id}/orders`, { query: { ...q } }),
};

export const ticketTypeApi = {
  list: (eventId: UUID) => api<TicketType[]>(`/events/${eventId}/ticket-types`),
  get: (id: UUID) => api<TicketType>(`/ticket-types/${id}`),
  create: (eventId: UUID, body: TicketTypeCreateRequest) =>
    api<TicketType>(`/events/${eventId}/ticket-types`, { method: 'POST', body }),
};

export const venueApi = {
  listForOrg: (orgId: UUID) => api<Venue[]>(`/organizations/${orgId}/venues`),
};

export const cartApi = {
  create: () => api<Cart>('/carts', { method: 'POST' }),
  get: (id: UUID) => api<Cart>(`/carts/${id}`),
  addItem: (id: UUID, ticketTypeId: UUID, quantity: number) =>
    api<Cart>(`/carts/${id}/items`, { method: 'POST', body: { ticketTypeId, quantity } }),
  removeItem: (id: UUID, itemId: UUID) =>
    api<void>(`/carts/${id}/items/${itemId}`, { method: 'DELETE' }),
  applyPromo: (id: UUID, code: string) =>
    api<Cart>(`/carts/${id}/promo-code`, { method: 'POST', body: { code } }),
  removePromo: (id: UUID) => api<Cart>(`/carts/${id}/promo-code`, { method: 'DELETE' }),
  checkout: (id: UUID, paymentMethodToken: string, idempotencyKey: string) =>
    api<Order>(`/carts/${id}/checkout`, {
      method: 'POST',
      body: { paymentMethodToken },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};

export const orderApi = {
  mine: (q: PageQuery = {}) =>
    api<PageResponse<Order>>('/users/me/orders', { query: { ...q } }),
  get: (id: UUID) => api<Order>(`/orders/${id}`),
};

export const ticketApi = {
  get: (id: UUID) => api<Ticket>(`/tickets/${id}`),
  transfer: (id: UUID, toUserId: UUID) =>
    api<Ticket>(`/tickets/${id}/transfer`, { method: 'POST', body: { toUserId } }),
  /** Rendered ticket as a Blob. Needs the bearer token, so a plain <a href> won't work. */
  artifact: async (id: UUID, format: 'digital' | 'physical') => {
    const res = await api<Response>(`/tickets/${id}/artifact`, {
      query: { format },
      raw: true,
      headers: { Accept: '*/*' },
    });
    return res.blob();
  },
};
