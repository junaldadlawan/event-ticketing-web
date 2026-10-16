import { ApiError, api, apiUrl } from './client';
import type {
  BackgroundFit,
  AppNotification,
  Cart,
  CheckoutPayment,
  Dispute,
  DisputeCreateRequest,
  DisputeStatus,
  EarningsInterval,
  OrgTransaction,
  OrganizationEarnings,
  FinanceSummary,
  OrganizationFinance,
  DisputeUpdateRequest,
  Category,
  Event,
  EventCreateRequest,
  EventStatus,
  EventUpdateRequest,
  Order,
  Organization,
  OrganizationDocument,
  EffectivePlatformFee,
  EventAnalytics,
  FeeScope,
  ModerationAction,
  ModerationActionRequest,
  ModerationTargetType,
  OrganizationMember,
  OrganizationRole,
  OrganizationStatus,
  Payout,
  CheckoutStart,
  GatewayFeeCheck,
  GatewayFeeRequest,
  GatewayFeeSetting,
  PayoutBatchRequest,
  PayoutWallet,
  PayoutCard,
  PayoutCardRequest,
  PayoutGenerateRequest,
  EligiblePayouts,
  PlatformFeeRule,
  PlatformFeeRuleRequest,
  UserUpdateRequest,
  PageResponse,
  Post,
  PostCreateRequest,
  PostUpdateRequest,
  RegisterDetails,
  CodePlacement,
  Ticket,
  TicketTemplate,
  TicketTemplateFormat,
  TextField,
  TicketType,
  TicketTypeCreateRequest,
  PromoCode,
  PromoCodeCreateRequest,
  PromoCodeUpdateRequest,
  SalesStatus,
  TicketTypeUpdateRequest,
  WaitlistEntry,
  TokenPair,
  UploadedImage,
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
  // The register DTO names the plaintext password field `passwordHash` (the server hashes it). No role is
  // sent: every new account is a customer, whatever the body says.
  register: (name: RegisterDetails, email: string, password: string) =>
    api<User>('/auth/register', {
      method: 'POST',
      body: { ...name, email, passwordHash: password },
    }),
  logout: (refreshToken: string) =>
    api<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  /**
   * Re-checks a password by signing in again, then closes the extra session
   * that sign-in opened. Uses plain fetch on purpose: the shared client treats
   * a 401 as an expired session (refresh, or log out), but here a 401 just
   * means "wrong password".
   */
  verifyPassword: async (email: string, password: string): Promise<boolean> => {
    const res = await fetch(apiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 401) return false;
    if (!res.ok) {
      let problem = null;
      try {
        problem = await res.json();
      } catch {
        // non-JSON error body
      }
      throw new ApiError(res.status, problem);
    }
    const { refreshToken } = (await res.json()) as TokenPair;
    fetch(apiUrl('/api/v1/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
    return true;
  },
};

export const userApi = {
  me: () => api<User>('/users/me'),
  /** avatarUrl: omit = unchanged, '' = remove the picture. */
  updateMe: (body: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    birthDate?: string;
    phoneNumber?: string;
    email?: string;
    avatarUrl?: string;
  }) =>
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

/**
 * Design fields sent on create/update. The code is either a placement, or
 * `{ codeType: 'NONE' }` when the organizer removed it from the ticket.
 * `textFields` replaces the whole list.
 */
export type TemplateDesign = {
  backgroundImageUrl?: string;
  /** "#RRGGBB"; "" on update = back to white. */
  backgroundColor?: string;
  backgroundFit?: BackgroundFit;
  backgroundX?: number;
  backgroundY?: number;
  backgroundWidth?: number;
  backgroundHeight?: number;
  ticketWidth?: number;
  ticketHeight?: number;
  textFields?: TextField[];
} & (CodePlacement | { codeType: 'NONE' });

export const ticketTemplateApi = {
  list: (eventId: UUID) => api<TicketTemplate[]>(`/events/${eventId}/ticket-templates`),
  create: (eventId: UUID, body: { ticketTypeId: UUID | null; format: TicketTemplateFormat } & TemplateDesign) =>
    api<TicketTemplate>(`/events/${eventId}/ticket-templates`, { method: 'POST', body }),
  /** backgroundImageUrl "" clears it. */
  update: (id: UUID, body: TemplateDesign) =>
    api<TicketTemplate>(`/ticket-templates/${id}`, { method: 'PATCH', body }),
  /** Deletes the template for good (it stops being listed or used). */
  delete: (id: UUID) => api<void>(`/ticket-templates/${id}`, { method: 'DELETE' }),
};

export const postApi = {
  /**
   * Public: only live posts (not hidden, published, not expired), newest first. Default: site-wide posts plus
   * posts of events that are on sale or done. `all` (admin only) lists every post, including hidden, scheduled
   * and expired ones.
   */
  list: (q: PageQuery & { eventId?: UUID; siteWide?: boolean; all?: boolean } = {}) =>
    api<PageResponse<Post>>('/posts', {
      query: { ...q, siteWide: q.siteWide ? 'true' : undefined, all: q.all ? 'true' : undefined },
    }),
  /** Admin only. Leave eventId out for a site-wide post. */
  create: (body: PostCreateRequest) => api<Post>('/posts', { method: 'POST', body }),
  /** Admin only. Change the kind, title or details of a post. */
  update: (id: UUID, body: PostUpdateRequest) => api<Post>(`/posts/${id}`, { method: 'PATCH', body }),
  /** Admin only. */
  remove: (id: UUID) => api<void>(`/posts/${id}`, { method: 'DELETE' }),
};

export const uploadApi = {
  /** PNG/JPEG/WebP/GIF, max 5 MB. Returns an absolute URL. */
  image: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<UploadedImage>('/uploads', { method: 'POST', body: form });
  },
};

export const organizationApi = {
  /** Submit an organizer application; it starts as PENDING until an admin approves it. */
  apply: (name: string, documents: OrganizationDocument[]) =>
    api<Organization>('/organizations', { method: 'POST', body: { name, documents } }),
  /** Members and their roles. Only members of the organization (or admins) may call this. */
  members: (orgId: UUID) => api<OrganizationMember[]>(`/organizations/${orgId}/members`),
  get: (orgId: UUID) => api<Organization>(`/organizations/${orgId}`),
  /** The caller's organizations, any status (owner / organizer / applicant). Needs GET /organizations/mine on the API. */
  mine: () => api<Organization[]>('/organizations/mine'),
  /** Admin: every organization, optionally only one status (PENDING / APPROVED / REJECTED / SUSPENDED). */
  list: (status?: OrganizationStatus) =>
    api<Organization[]>('/organizations', { query: { status } }),
  rename: (orgId: UUID, name: string) =>
    api<Organization>(`/organizations/${orgId}`, { method: 'PATCH', body: { name } }),
  approve: (orgId: UUID) => api<Organization>(`/organizations/${orgId}/approve`, { method: 'POST' }),
  reject: (orgId: UUID, reason?: string) =>
    api<Organization>(`/organizations/${orgId}/reject`, { method: 'POST', body: reason ? { reason } : {} }),
  /** OWNER can't be assigned here (it only comes from approving the application). */
  assignMember: (orgId: UUID, userId: UUID, role: OrganizationRole) =>
    api<OrganizationMember>(`/organizations/${orgId}/members`, { method: 'POST', body: { userId, role } }),
};

/** Admin only. */
export const adminUserApi = {
  list: () => api<User[]>('/users'),
  update: (id: UUID, body: UserUpdateRequest) => api<User>(`/users/${id}`, { method: 'PATCH', body }),
  remove: (id: UUID) => api<void>(`/users/${id}`, { method: 'DELETE' }),
};

/** Admin only: suspend / reinstate / remove an organization, event or user, with a reason that is kept. */
export const moderationApi = {
  create: (body: ModerationActionRequest) =>
    api<ModerationAction>('/admin/moderation-actions', { method: 'POST', body }),
  list: (q: PageQuery & { targetType?: ModerationTargetType; targetId?: UUID } = {}) =>
    api<PageResponse<ModerationAction>>('/admin/moderation-actions', { query: { ...q } }),
};

/** Admin only: the platform fee ("overhead") rules. */
export const platformFeeApi = {
  list: (scope?: FeeScope) => api<PlatformFeeRule[]>('/platform-fees', { query: { scope } }),
  effective: (eventId: UUID) => api<EffectivePlatformFee>('/platform-fees/effective', { query: { eventId } }),
  setDefault: (body: PlatformFeeRuleRequest) =>
    api<PlatformFeeRule>('/platform-fees/default', { method: 'PUT', body }),
  removeDefault: () => api<void>('/platform-fees/default', { method: 'DELETE' }),
  setForOrganization: (orgId: UUID, body: PlatformFeeRuleRequest) =>
    api<PlatformFeeRule>(`/platform-fees/organizations/${orgId}`, { method: 'PUT', body }),
  removeForOrganization: (orgId: UUID) => api<void>(`/platform-fees/organizations/${orgId}`, { method: 'DELETE' }),
  setForEvent: (eventId: UUID, body: PlatformFeeRuleRequest) =>
    api<PlatformFeeRule>(`/platform-fees/events/${eventId}`, { method: 'PUT', body }),
  removeForEvent: (eventId: UUID) => api<void>(`/platform-fees/events/${eventId}`, { method: 'DELETE' }),
};

export const analyticsApi = {
  /** Owner / organizer of the event's organization, or an admin. */
  event: (eventId: UUID) => api<EventAnalytics>(`/events/${eventId}/analytics`),
  /** Admin only. Dates are UTC days (YYYY-MM-DD); the period is at most 366 days. */
  platformFinance: (q: { from?: string; to?: string; currency?: string } = {}) =>
    api<FinanceSummary>('/analytics/platform/finance', { query: { ...q } }),
  /** The organization's owner, or an admin. */
  organizationFinance: (orgId: UUID, q: { from?: string; to?: string; currency?: string } = {}) =>
    api<OrganizationFinance>(`/organizations/${orgId}/finance`, { query: { ...q } }),
  /** The organization's owner, or an admin: income per day or month for the chart. */
  organizationEarnings: (orgId: UUID, q: { interval: EarningsInterval; from?: string; to?: string }) =>
    api<OrganizationEarnings>(`/organizations/${orgId}/finance/earnings`, { query: { ...q } }),
  /** The organization's owner, or an admin: sales, refunds and payouts, newest first. */
  organizationTransactions: (orgId: UUID, q: PageQuery & { from?: string; to?: string } = {}) =>
    api<PageResponse<OrgTransaction>>(`/organizations/${orgId}/transactions`, { query: { ...q } }),
};

/** The signed-in customer's saved payment methods. Needs the payment-method endpoints on the API (see the API prompt). */
export const paymentMethodApi = {
  list: () => api<PayoutCard[]>('/users/me/payment-methods'),
  add: (body: Partial<PayoutCardRequest> & { paymentToken: string; primary: boolean }) =>
    api<PayoutCard>('/users/me/payment-methods', { method: 'POST', body }),
  setPrimary: (id: UUID) => api<PayoutCard>(`/users/me/payment-methods/${id}/primary`, { method: 'PUT' }),
  remove: (id: UUID) => api<void>(`/users/me/payment-methods/${id}`, { method: 'DELETE' }),
  /** Stripe: a setup intent for the signed-in customer; the card field confirms it with the client secret. */
  setupIntent: () => api<{ clientSecret: string }>('/users/me/payment-methods/setup-intent', { method: 'POST' }),
};

/** An organization's payout cards. Needs the payout-card endpoints on the API (see the API prompt). */
export const payoutCardApi = {
  list: (orgId: UUID) => api<PayoutCard[]>(`/organizations/${orgId}/payout-cards`),
  add: (orgId: UUID, body: PayoutCardRequest) =>
    api<PayoutCard>(`/organizations/${orgId}/payout-cards`, { method: 'POST', body }),
  setPrimary: (cardId: UUID) => api<PayoutCard>(`/payout-cards/${cardId}/primary`, { method: 'PUT' }),
  remove: (cardId: UUID) => api<void>(`/payout-cards/${cardId}`, { method: 'DELETE' }),
};

/** Admin only: the payment gateway's fee, and who pays it. */
export const gatewayFeeApi = {
  get: () => api<GatewayFeeSetting>('/payment-gateway-fee'),
  update: (body: GatewayFeeRequest) => api<GatewayFeeSetting>('/payment-gateway-fee', { method: 'PUT', body }),
  /** The setting next to what the gateway really charged on its latest paid payments (limit 1-20). */
  check: (limit = 5) => api<GatewayFeeCheck>('/payment-gateway-fee/check', { query: { limit } }),
};

/** Admin only: the wallet organizers are paid from (balance, limits, usage, account). 404 when PayMongo has no wallet yet. */
export const payoutWalletApi = {
  get: () => api<PayoutWallet>('/payout-wallet'),
};

export const notificationApi = {
  /** The signed-in user's notifications (any role). The API has no read flag. */
  mine: () => api<AppNotification[]>('/users/me/notifications'),
};

export const disputeApi = {
  /** Any signed-in user: report a problem with an order or ticket. */
  create: (body: DisputeCreateRequest) => api<Dispute>('/disputes', { method: 'POST', body }),
  /** Admin only. */
  list: (q: PageQuery & { status?: DisputeStatus } = {}) => api<PageResponse<Dispute>>('/disputes', { query: { ...q } }),
  /** Admin only: move it to investigating, resolved or dismissed, with the outcome. Resolved/dismissed are final (409 after). */
  update: (id: UUID, body: DisputeUpdateRequest) => api<Dispute>(`/disputes/${id}`, { method: 'PATCH', body }),
};

export const payoutApi = {
  /** Admin only: settle the organization's paid orders of the period that are not in a payout yet (fees are deducted). */
  generate: (orgId: UUID, body: PayoutGenerateRequest) =>
    api<Payout>(`/organizations/${orgId}/payouts`, { method: 'POST', body }),
  /** Owner / organizer of the organization, or an admin. Newest first. */
  list: (orgId: UUID, q: PageQuery = {}) =>
    api<PageResponse<Payout>>(`/organizations/${orgId}/payouts`, { query: { ...q } }),
  /** Admin only. Needs GET /payouts/eligible on the API (see the API prompt). */
  eligible: (q: { periodStart: string; periodEnd: string; organizationId?: UUID; eventScope: 'COMPLETED' | 'ALL' }) =>
    api<EligiblePayouts>('/payouts/eligible', { query: { ...q } }),
  /** Admin only. Needs POST /payouts/batch on the API. One payout per organization among the chosen lines. */
  generateBatch: (body: PayoutBatchRequest) => api<Payout[]>('/payouts/batch', { method: 'POST', body }),
};

export const categoryApi = {
  /** Active categories only, in display order. Public. */
  list: () => api<Category[]>('/categories'),
};

export const ticketTypeApi = {
  list: (eventId: UUID) => api<TicketType[]>(`/events/${eventId}/ticket-types`),
  get: (id: UUID) => api<TicketType>(`/ticket-types/${id}`),
  update: (id: UUID, body: TicketTypeUpdateRequest) =>
    api<TicketType>(`/ticket-types/${id}`, { method: 'PATCH', body }),
  remove: (id: UUID) => api<void>(`/ticket-types/${id}`, { method: 'DELETE' }),
  /** Pause or resume selling a ticket type (the one place that sets it). */
  setSalesStatus: (id: UUID, status: SalesStatus) =>
    api<TicketType>(`/ticket-types/${id}/sales-status`, { method: 'PUT', body: { status } }),
  create: (eventId: UUID, body: TicketTypeCreateRequest) =>
    api<TicketType>(`/events/${eventId}/ticket-types`, { method: 'POST', body }),
  /** Save the arrangement: every ticket type of the event, first to last. Returns them in the new order. */
  reorder: (eventId: UUID, ticketTypeIds: UUID[]) =>
    api<TicketType[]>(`/events/${eventId}/ticket-types/order`, { method: 'PUT', body: { ticketTypeIds } }),
};

export const venueApi = {
  listForOrg: (orgId: UUID) => api<Venue[]>(`/organizations/${orgId}/venues`),
};

export const cartApi = {
  create: () => api<Cart>('/carts', { method: 'POST' }),
  /** With itemIds: the cart priced for only those items, exactly what checkout with the same itemIds will charge. */
  get: (id: UUID, itemIds?: UUID[]) => api<Cart>(`/carts/${id}`, itemIds ? { query: { itemIds: itemIds.join(',') } } : {}),
  addItem: (id: UUID, ticketTypeId: UUID, quantity: number) =>
    api<Cart>(`/carts/${id}/items`, { method: 'POST', body: { ticketTypeId, quantity } }),
  /** Sets the quantity of a general-admission line; held inventory moves by the difference and the hold's expiry is kept. */
  setQuantity: (id: UUID, itemId: UUID, quantity: number) =>
    api<Cart>(`/carts/${id}/items/${itemId}`, { method: 'PATCH', body: { quantity } }),
  removeItem: (id: UUID, itemId: UUID) =>
    api<void>(`/carts/${id}/items/${itemId}`, { method: 'DELETE' }),
  applyPromo: (id: UUID, code: string) =>
    api<Cart>(`/carts/${id}/promo-code`, { method: 'POST', body: { code } }),
  removePromo: (id: UUID) => api<Cart>(`/carts/${id}/promo-code`, { method: 'DELETE' }),
  /** Pay with a one-off token (a new card) or with a card the customer saved (paymentMethodId). */
  checkout: (id: UUID, payment: CheckoutPayment, idempotencyKey: string, itemIds?: UUID[]) =>
    api<Order | CheckoutStart>(`/carts/${id}/checkout`, {
      method: 'POST',
      body: itemIds ? { ...payment, itemIds } : payment,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};

/** With PayMongo: where a started checkout stands (only the buyer who started it can read it). */
export const checkoutApi = {
  status: (id: UUID) => api<CheckoutStart>(`/checkouts/${id}`),
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

export const promoApi = {
  /** The organizer's view: every promo code of the event. */
  list: (eventId: UUID) => api<PromoCode[]>(`/events/${eventId}/promo-codes`),
  create: (eventId: UUID, body: PromoCodeCreateRequest) =>
    api<PromoCode>(`/events/${eventId}/promo-codes`, { method: 'POST', body }),
  update: (id: UUID, body: PromoCodeUpdateRequest) =>
    api<PromoCode>(`/promo-codes/${id}`, { method: 'PATCH', body }),
  /** Pause or resume a code. Orders that already used it are untouched. */
  setStatus: (id: UUID, status: 'ACTIVE' | 'PAUSED') =>
    api<PromoCode>(`/promo-codes/${id}/status`, { method: 'PUT', body: { status } }),
  /** Only a code nobody has used yet (the API answers 409 otherwise). */
  remove: (id: UUID) => api<void>(`/promo-codes/${id}`, { method: 'DELETE' }),
};

export const waitlistApi = {
  /** Join the line for a sold-out ticket type (omit the id to wait for the event in general). */
  join: (eventId: UUID, ticketTypeId?: UUID) =>
    api<WaitlistEntry>(`/events/${eventId}/waitlist`, { method: 'POST', body: ticketTypeId ? { ticketTypeId } : {} }),
};
