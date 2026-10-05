// Mirrors the API's response/request records (camelCase JSON).

export type UUID = string;

export interface Money {
  /** Minor units, e.g. cents. */
  amount: number;
  currency: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPage: number;
  last: boolean;
}

/** Spring ProblemDetail (RFC 7807), returned for every API error. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

export type Role = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ON_SALE'
  | 'SOLD_OUT'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'SUSPENDED';

export interface VenueSnapshot {
  id: UUID;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Venue extends VenueSnapshot {
  organizationId: UUID;
}

export interface Event {
  id: UUID;
  organizationId: UUID;
  title: string;
  description: string;
  category: string;
  venue: VenueSnapshot | null;
  startAt: string;
  endAt: string;
  timezone: string;
  images: string[] | null;
  status: EventStatus;
  ticketPrefix: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EventCreateRequest {
  organizationId: UUID;
  title: string;
  description: string;
  category: string;
  venueId?: UUID;
  startAt: string;
  endAt: string;
  timezone: string;
  images?: string[];
}

export interface EventUpdateRequest {
  title?: string;
  description?: string;
  category?: string;
  images?: string[];
}

export type TicketTypeKind = 'GENERAL_ADMISSION' | 'RESERVED_SEATING';

export interface TicketType {
  id: UUID;
  eventId: UUID;
  name: string;
  kind: TicketTypeKind;
  price: Money;
  quantityTotal: number;
  quantityAvailable: number;
  saleStartAt: string;
  saleEndAt: string;
  maxPerOrder: number;
}

export interface TicketTypeCreateRequest {
  name: string;
  kind: TicketTypeKind;
  price: Money;
  quantityTotal: number;
  saleStartAt: string;
  saleEndAt: string;
  maxPerOrder?: number;
}

export interface CartItem {
  id: UUID;
  ticketTypeId: UUID;
  seatId: UUID | null;
  quantity: number;
  holdExpiresAt: string;
  createdAt: string;
}

export interface Cart {
  id: UUID;
  buyerId: UUID;
  items: CartItem[];
  appliedPromoCode: { code: string; discountAmount: Money } | null;
  total: Money;
  createdAt: string;
  updatedAt?: string;
}

export type TicketStatus = 'VALID' | 'USED' | 'TRANSFERRED' | 'REFUNDED' | 'CANCELLED';

export interface Ticket {
  id: UUID;
  orderId: UUID;
  eventId: UUID;
  ticketTypeId: UUID;
  seatId: UUID | null;
  ownerId: UUID;
  ticketNumber: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt?: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface Order {
  id: UUID;
  buyerId: UUID;
  payeeType: string;
  payeeId: UUID;
  status: OrderStatus;
  promoCode: string | null;
  total: Money;
  tickets: Ticket[];
  createdAt: string;
  updatedAt?: string;
}
