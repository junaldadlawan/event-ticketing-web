import { ApiError, api } from './client';
import type {
  BackgroundFit,
  Cart,
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
  PayoutGenerateRequest,
  PlatformFeeRule,
  PlatformFeeRuleRequest,
  UserUpdateRequest,
  PageResponse,
  Post,
  PostCreateRequest,
  PostUpdateRequest,
  CodePlacement,
  Ticket,
  TicketTemplate,
  TicketTemplateFormat,
  TextField,
  TicketType,
  TicketTypeCreateRequest,
  PromoCode,
  PromoCodeCreateRequest,
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
  // The register DTO names the plaintext password field `passwordHash`
  // (the server hashes it) and requires a role.
  register: (name: string, email: string, password: string) =>
    api<User>('/auth/register', {
      method: 'POST',
      body: { name, email, passwordHash: password, role: 'CUSTOMER' },
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
    const res = await fetch('/api/v1/auth/login', {
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
    fetch('/api/v1/auth/logout', {
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
  updateMe: (body: { name?: string; email?: string; avatarUrl?: string }) =>
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
};

export const payoutApi = {
  /** Admin only: settle the organization's paid orders of the period that are not in a payout yet (fees are deducted). */
  generate: (orgId: UUID, body: PayoutGenerateRequest) =>
    api<Payout>(`/organizations/${orgId}/payouts`, { method: 'POST', body }),
  /** Owner / organizer of the organization, or an admin. Newest first. */
  list: (orgId: UUID, q: PageQuery = {}) =>
    api<PageResponse<Payout>>(`/organizations/${orgId}/payouts`, { query: { ...q } }),
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

export const promoApi = {
  /** The organizer's view: every promo code of the event. */
  list: (eventId: UUID) => api<PromoCode[]>(`/events/${eventId}/promo-codes`),
  create: (eventId: UUID, body: PromoCodeCreateRequest) =>
    api<PromoCode>(`/events/${eventId}/promo-codes`, { method: 'POST', body }),
};

export const waitlistApi = {
  /** Join the line for a sold-out ticket type (omit the id to wait for the event in general). */
  join: (eventId: UUID, ticketTypeId?: UUID) =>
    api<WaitlistEntry>(`/events/${eventId}/waitlist`, { method: 'POST', body: ticketTypeId ? { ticketTypeId } : {} }),
};
