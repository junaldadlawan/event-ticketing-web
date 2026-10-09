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
  /** Profile picture (an /api/v1/uploads/files/ URL), or null/absent when none. */
  avatarUrl?: string | null;
  /** Admin list only (once the API returns it). */
  accountStatus?: AccountStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type TicketTemplateFormat = 'DIGITAL' | 'PHYSICAL';

/** COVER fills and crops, CONTAIN shows it all, STRETCH distorts to fit, CUSTOM = moved/resized by the organizer (backgroundX/Y/Width/Height). */
export type BackgroundFit = 'COVER' | 'CONTAIN' | 'STRETCH' | 'CUSTOM';
export const BACKGROUND_FITS: BackgroundFit[] = ['COVER', 'CONTAIN', 'STRETCH', 'CUSTOM'];

export type CodeType = 'QR' | 'BARCODE';

/** On a template: a code type, or NONE = the organizer removed the code from the ticket. */
export type TemplateCodeType = CodeType | 'NONE';

/**
 * What a text field prints. Dynamic keys differ per ticket (type, seat,
 * number, attendee); static keys are the same on every ticket of the event
 * (event name, date, time, venue); CUSTOM prints the organizer's own `text`.
 */
export type DynamicTextFieldKey = 'TICKET_TYPE' | 'SECTION' | 'ROW' | 'SEAT' | 'TICKET_NUMBER' | 'ATTENDEE_NAME';
export type StaticTextFieldKey = 'EVENT_NAME' | 'EVENT_DATE' | 'EVENT_TIME' | 'VENUE';
export type TextFieldKey = DynamicTextFieldKey | StaticTextFieldKey | 'CUSTOM';
export type TextFieldAlign = 'LEFT' | 'CENTER' | 'RIGHT';

/**
 * A placed text field. x = anchor point in % of the ticket width (left edge
 * for LEFT, centre for CENTER, right edge for RIGHT), y = the text line's
 * vertical centre in % of the ticket height, fontSize = % of ticket height.
 */
/** The API returns unused optional members as null; the designer treats null as "not set". */
export interface TextField {
  key: TextFieldKey;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  align: TextFieldAlign;
  /**
   * How many characters the placeholder shows in the designer ("XXX" = 3), so
   * the organizer can size it for the longest real value. Design aid only:
   * tickets print the real value.
   */
  sampleLength?: number | null;
  /**
   * Dynamic fields only: the organizer's own placeholder text instead of X's
   * (e.g. "Juan Dela Cruz", 1-30 characters). When set, it is what the
   * designer shows and its width is the reserved box; absent = X's.
   */
  sampleText?: string | null;
  // Dynamic fields: the X box (sampleLength X's wide) is the reserved space;
  // align is the fill direction - the value starts at its left (LEFT), middle
  // (CENTER) or right (RIGHT) and grows from there.
  /** Degrees clockwise (0-359), turned around the centre of the text's box (all lines). */
  rotation?: number | null;
  /** CUSTOM only: the label printed as-is (1-60 characters). */
  text?: string | null;
  /**
   * Where the text breaks onto a new line: character positions in the printed
   * value, ascending. [6] splits "Sunset Music" into "Sunset" / "Music"
   * (spaces at a break are trimmed). Positions past the end of a shorter
   * value are ignored. Empty/absent = one line.
   */
  lineBreaks?: number[] | null;
  /**
   * Designer-only handle, never sent to the API: the key itself, or a
   * generated id for CUSTOM labels (a ticket can have several).
   */
  id?: string;
}

/**
 * Where the scannable code sits on the ticket, in percent:
 * codeX / codeY = top-left corner as % of the ticket's width / height,
 * codeWidth = width as % of the ticket's width. The height follows from the
 * type's fixed shape (QR square, barcode 3:1). x/y/width describe the
 * unrotated box; codeRotation turns it clockwise around its centre
 * (0-359 degrees, barcode only - always 0 for QR).
 */
export interface CodePlacement {
  codeType: CodeType;
  codeX: number;
  codeY: number;
  codeWidth: number;
  codeRotation: number;
}

export interface TicketTemplate {
  id: UUID;
  eventId: UUID;
  /** null = applies to every ticket type of the event */
  ticketTypeId: UUID | null;
  format: TicketTemplateFormat;
  logoUrl: string | null;
  /** null or "" = no background */
  backgroundImageUrl: string | null;
  primaryColor: string | null;
  /** The ticket's fill color ("#RRGGBB"), under the background image; null = white. */
  backgroundColor?: string | null;
  /** How the background image fills the ticket when their shapes differ (default COVER). */
  backgroundFit?: BackgroundFit | null;
  /** CUSTOM only: the image's top-left corner and size, in % of the ticket's width / height. */
  backgroundX?: number | null;
  backgroundY?: number | null;
  backgroundWidth?: number | null;
  backgroundHeight?: number | null;
  codeType: TemplateCodeType | null;
  /** Placed text fields; absent/null on API builds that don't support them yet. */
  textFields?: TextField[] | null;
  codeX: number | null;
  codeY: number | null;
  codeWidth: number | null;
  codeRotation: number | null;
  /**
   * The ticket's size in pixels (taken from the background image). Sent on
   * save; older API builds ignore it and return nothing, so it's optional.
   */
  ticketWidth?: number | null;
  ticketHeight?: number | null;
}

export interface UploadedImage {
  url: string;
  contentType: string;
  size: number;
}

export type OrganizationRole = 'OWNER' | 'ORGANIZER' | 'CHECK_IN_STAFF';

export interface OrganizationMember {
  userId: UUID;
  organizationId: UUID;
  roles: OrganizationRole[];
  assignedAt: string;
  /** Who the member is (absent until the API returns them with the member). */
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export type OrganizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface OrganizationDocument {
  /** e.g. "Business permit" */
  type: string;
  url: string;
}

export interface Organization {
  id: UUID;
  name: string;
  status: OrganizationStatus;
  documents: OrganizationDocument[];
  ownerId: UUID | null;
  rejectionReason: string | null;
  createdAt: string;
  /** Last change (approval, rejection, suspension, rename...). */
  updatedAt?: string | null;
  /** When an admin approved the application (absent until the API records it). */
  approvedAt?: string | null;
}

export interface Category {
  id: UUID;
  /** What events store and what search/create expect. */
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
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
  /** While true the type can not be added to a cart (the organizer paused sales). */
  salesPaused: boolean;
  /** Where it sits in the event's list (0 = first), as arranged by the organizer. */
  position: number;
  /** When it was created (tie-break for the order). */
  createdAt?: string;
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
  /** The platform fee added on top of the tickets (0 or absent when none applies). */
  platformFee?: Money | null;
  /** Tickets - promo discount + platform fee: what the buyer pays. */
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
  /** The platform fee that was added on top of the tickets (it is included in `total`). */
  platformFee?: Money | null;
  total: Money;
  tickets: Ticket[];
  createdAt: string;
  updatedAt?: string;
}

/** Ticket type fields that can be changed after creation; leave a field out to keep it (kind never changes). */
export interface TicketTypeUpdateRequest {
  name?: string;
  price?: Money;
  quantityTotal?: number;
  saleStartAt?: string;
  saleEndAt?: string;
  maxPerOrder?: number;
  /** true pauses sales, false resumes. */
  salesPaused?: boolean;
}

export type DiscountType = 'PERCENTAGE' | 'FIXED';

/** A promo code. discountValue is a percent (0-100) for PERCENTAGE, minor units (cents) for FIXED. */
export interface PromoCode {
  id: UUID;
  eventId: UUID;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  /** Empty / absent = every ticket type of the event. */
  applicableTicketTypeIds?: UUID[] | null;
  usageLimitTotal?: number | null;
  usageLimitPerBuyer?: number | null;
  validFrom: string;
  validUntil: string;
}

export interface PromoCodeCreateRequest {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  applicableTicketTypeIds?: UUID[];
  usageLimitTotal?: number;
  usageLimitPerBuyer?: number;
  validFrom: string;
  validUntil: string;
}

/** A buyer's place in line for a sold-out event / ticket type. */
export interface WaitlistEntry {
  id: UUID;
  eventId: UUID;
  ticketTypeId?: UUID | null;
  position: number;
}

/** Whether a ticket type is being sold: ACTIVE (normal) or PAUSED (can't be bought; nothing is deleted). */
export type SalesStatus = 'ACTIVE' | 'PAUSED';

export type PostKind = 'ANNOUNCEMENT' | 'SALE';

/** Where a post is in its life: only LIVE posts are public. */
export type PostStatus = 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'HIDDEN';

/** An admin's sale or announcement: site-wide (eventId null, shown on Home) or about one event. */
export interface Post {
  id: UUID;
  eventId?: UUID | null;
  eventTitle?: string | null;
  kind: PostKind;
  title: string;
  body: string;
  createdAt: string;
  /** Public from this moment (absent = as soon as it was created). */
  publishAt?: string | null;
  /** Not public from this moment on (absent = never). */
  expiresAt?: string | null;
  /** An admin switch: a hidden post is never public, whatever its dates say. */
  hidden?: boolean;
  /** Optional picture (an /api/v1/uploads/files/ URL). */
  imageUrl?: string | null;
  status?: PostStatus;
}

export interface PostCreateRequest {
  eventId?: UUID;
  kind: PostKind;
  title: string;
  body?: string;
  /** Leave out to publish right away. */
  publishAt?: string;
  /** Leave out for a post that never expires. */
  expiresAt?: string;
  hidden?: boolean;
  /** An image uploaded with POST /uploads; leave out for a post without a picture. */
  imageUrl?: string;
}

/** Fields of a post that can be changed (the event it belongs to can not). */
export interface PostUpdateRequest {
  kind?: PostKind;
  title?: string;
  body?: string;
  publishAt?: string;
  expiresAt?: string;
  hidden?: boolean;
  /** Omit = keep the picture, '' = remove it, a URL = replace it. */
  imageUrl?: string;
  /** Left out or false = leave the date alone; true = remove it. */
  clearPublishAt?: boolean;
  clearExpiresAt?: boolean;
}

/** Admin: an account state the API enforces at login (absent until the API returns it). */
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type ModerationTargetType = 'ORGANIZATION' | 'EVENT' | 'USER';
export type ModerationActionType = 'SUSPEND' | 'REINSTATE' | 'REMOVE';

export interface ModerationActionRequest {
  targetType: ModerationTargetType;
  targetId: UUID;
  action: ModerationActionType;
  /** Required, up to 1000 characters; kept as the audit trail. */
  reason: string;
}

export interface ModerationAction {
  id: UUID;
  targetType: ModerationTargetType;
  targetId: UUID;
  action: ModerationActionType;
  reason: string;
  previousStatus?: string | null;
  performedBy: UUID;
  createdAt: string;
}

/** Platform fee ("overhead") rule: one per scope; the most specific one applies to a purchase. */
export type FeeScope = 'PLATFORM' | 'ORGANIZATION' | 'EVENT';
export type FeeType = 'PERCENTAGE' | 'FLAT';

export interface PlatformFeeRule {
  id: UUID;
  scope: FeeScope;
  /** Null for the platform default. */
  scopeId?: UUID | null;
  type: FeeType;
  /** 0-100, for PERCENTAGE. */
  percentage?: number | null;
  /** Minor units + currency, for FLAT. */
  flatAmount?: Money | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PlatformFeeRuleRequest {
  type: FeeType;
  percentage?: number;
  flatAmount?: Money;
}

export interface EffectivePlatformFee {
  eventId: UUID;
  organizationId: UUID;
  /** Null when no rule applies (no fee is charged). */
  rule?: PlatformFeeRule | null;
}

export type PayoutStatus = 'SCHEDULED' | 'PAID' | 'FAILED';

export interface Payout {
  id: UUID;
  organizationId: UUID;
  gross: Money;
  fees: Money;
  net: Money;
  periodStart: string;
  periodEnd: string;
  status: PayoutStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
  role?: Role;
}

export interface EventAnalytics {
  eventId: UUID;
  ticketsSold: number;
  revenue: Money;
  remainingInventory: number;
  salesOverTime: { date: string; ticketsSold: number; revenue: Money }[];
}

export interface PayoutGenerateRequest {
  /** First day included (UTC). */
  periodStart: string;
  /** Last day included (UTC); not in the future. */
  periodEnd: string;
}
