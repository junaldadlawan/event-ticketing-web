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
  /** Card payments: the card needs an extra step (3-D Secure); `clientSecret` lets Stripe's page finish it. */
  error?: string;
  clientSecret?: string;
}

export type Role = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: UUID;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  /** YYYY-MM-DD; absent on accounts made before the API asked for it. */
  birthDate?: string | null;
  /** International format (+ and 8 to 15 digits), or empty / absent. */
  phoneNumber?: string | null;
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
  /** Left out = the sale starts the moment the API saves it. */
  saleStartAt?: string;
  /** At least an hour before the event starts, or the API refuses it (400). */
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
  /** The payment gateway's fee, when management made the customer pay it (0 or absent otherwise). Included in `total`. */
  gatewayFee?: Money | null;
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
  /** The payment gateway's fee the buyer paid on top (included in `total`); 0 when the customer did not bear it. */
  gatewayFee?: Money | null;
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
  /** The organizer switched it off: it can not be applied to a cart. */
  paused?: boolean;
  /** How many orders used it; a used code keeps its code and discount type, and can only be paused. */
  usedCount?: number;
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
/** Who shoulders the platform fee: the same choices as the gateway fee. */
export type FeePayer = GatewayFeePayer;

/** COMBINED is a percentage plus a fixed amount per ticket. */
export type FeeType = 'PERCENTAGE' | 'FLAT' | 'COMBINED';

export interface PlatformFeeRule {
  id: UUID;
  scope: FeeScope;
  /** Null for the platform default. */
  scopeId?: UUID | null;
  type: FeeType;
  /** 0-100, for PERCENTAGE and COMBINED. */
  percentage?: number | null;
  /** Minor units + currency, for FLAT and COMBINED. */
  flatAmount?: Money | null;
  /** Who shoulders the fee. Absent until the API stores it (then the customer pays, as before). */
  payer?: FeePayer | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PlatformFeeRuleRequest {
  type: FeeType;
  percentage?: number;
  flatAmount?: Money;
  payer?: FeePayer;
}

export interface EffectivePlatformFee {
  eventId: UUID;
  organizationId: UUID;
  /** Null when no rule applies (no fee is charged). */
  rule?: PlatformFeeRule | null;
}

export type PayoutStatus = 'SCHEDULED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface Payout {
  id: UUID;
  organizationId: UUID;
  gross: Money;
  fees: Money;
  net: Money;
  periodStart: string;
  periodEnd: string;
  /** The event this payout settles (the "after the event" method); absent for period payouts. */
  eventTitle?: string | null;
  status: PayoutStatus;
  /** Why a FAILED payout failed. */
  failureReason?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UserUpdateRequest {
  firstName?: string;
  /** '' removes the middle name. */
  middleName?: string;
  lastName?: string;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  role?: Role;
}

/** What the sign-up form sends (besides email and password). */
export interface RegisterDetails {
  firstName: string;
  middleName?: string;
  lastName: string;
  /** YYYY-MM-DD, required. */
  birthDate: string;
  /** Optional, international format. */
  phoneNumber?: string;
}

export interface EventAnalytics {
  eventId: UUID;
  ticketsSold: number;
  revenue: Money;
  remainingInventory: number;
  salesOverTime: { date: string; ticketsSold: number; revenue: Money }[];
}

/** Buyers by age group (age at their first order). A group of 1 to 4 buyers is hidden: buyers and tickets null. */
export interface EventAudience {
  eventId: UUID;
  buyers: number;
  unknownAge: number;
  ageGroups: { label: string; buyers: number | null; tickets: number | null }[];
}

/** What an activity entry recorded, beyond the action (null on entries from before details existed). */
export interface ActivityDetails {
  /** *.updated: only the fields that changed, by their API name. Money is {amount, currency}, dates ISO, lists their count. */
  changes?: { field: string; from: unknown; to: unknown }[];
  /** Created / deleted items, paused / resumed ones, scanner devices: the item's name (kept even once it is deleted). */
  name?: string;
  /** ticket_type.reordered: the ticket type names, first to last. */
  order?: string[];
  /** refund.issued */
  orderId?: string;
  amount?: Money;
  /** refund.issued, event moderation: the reason given. */
  reason?: string;
  /** Team changes: the role or roles given. */
  role?: string;
  roles?: string[];
  [key: string]: unknown;
}

/** One entry of GET /events/{id}/activity (BR-EVENT-006): who did what to the event, and when. */
export interface EventActivityEntry {
  id: UUID;
  /** Null when the system acted on its own (e.g. event.completed). */
  actorId: UUID | null;
  /** Null for the system, or a user that no longer exists. */
  actorName: string | null;
  /** e.g. "ticket_type.sales_paused", "event.published", "refund.issued". */
  action: string;
  targetType: string | null;
  targetId: UUID | null;
  eventId: UUID | null;
  /** The event's title, on an event's entries in an organization's or the platform's log. */
  eventTitle?: string | null;
  details: ActivityDetails | null;
  createdAt: string;
}

/** The management tab a log belongs to (GET /activity). */
export type ActivityArea = 'EVENTS' | 'TEAM' | 'FINANCE' | 'SETTINGS' | 'POSTS' | 'ORGANIZATIONS' | 'USERS' | 'DISPUTES';

/** When tickets sell, in the event's time zone. byWeekday is Monday first (7), byHour 0-23 (24). */
export interface EventSalesPatterns {
  eventId: UUID;
  timezone: string;
  tickets: number;
  orders: number;
  promoOrders: number;
  daily: { day: string; tickets: number }[];
  byWeekday: number[];
  byHour: number[];
}

/** Views, add-to-cart and checkout for the days from..to in the event's time zone. Rates are fractions (0.25 = 25%), null without a base. */
export interface EventFunnel {
  eventId: UUID;
  timezone: string;
  from: string;
  to: string;
  views: number;
  uniqueVisitors: number;
  addToCart: { actions: number; quantity: number; uniqueBuyers: number };
  checkedOut: { quantity: number; uniqueBuyers: number };
  viewToCartRate: number | null;
  viewToPurchaseRate: number | null;
  daily: { day: string; views: number; uniqueVisitors: number; addToCartQuantity: number; checkedOutQuantity: number }[];
  ticketTypes: {
    ticketTypeId: UUID;
    name: string;
    addToCartActions: number;
    addedQuantity: number;
    uniqueBuyersAdding: number;
    checkedOutQuantity: number;
    removedQuantity: number;
    expiredQuantity: number;
    cartConversionRate: number | null;
  }[];
  /** When the logs started on this server; nothing before it was recorded. */
  trackingSince: string | null;
}

/** One line of "what can be paid out now": an organization (and its event) with the amount ready or held back. */
/** A card an organization is paid out to. Only the last four digits are kept; the primary card receives payouts. */
/** With PayMongo, checkout only STARTS the payment: no order exists until the webhook marks it PAID. */
export interface CheckoutStart {
  checkoutId: UUID;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  /** Secret for this one payment (never log it): the card is attached with it, from the browser. */
  clientKey?: string | null;
  amount: number;
  currency: string;
  orderId?: UUID | null;
  failureReason?: string | null;
  /** Only when a saved card was paid with from the server: NONE = the webhook completes the order, REDIRECT = 3-D Secure at `redirectUrl`. */
  nextAction?: 'NONE' | 'REDIRECT' | null;
  redirectUrl?: string | null;
  /** Saving the card was asked for: REQUESTED = it will be saved, UNAVAILABLE = the payment goes on but the card cannot be saved. */
  cardSaving?: 'REQUESTED' | 'UNAVAILABLE' | 'NOT_REQUESTED' | null;
}

/** What the buyer pays with, in the body of POST /carts/{id}/checkout. A saved card on PayMongo also needs its security code and a return URL. */
export interface CheckoutPayment {
  paymentMethodToken?: string;
  paymentMethodId?: UUID;
  /** PayMongo, saved card: set on the payment method for this one payment. Never stored. */
  securityCode?: string;
  /** PayMongo, saved card: where the bank sends the buyer back after 3-D Secure. */
  returnUrl?: string;
  /** PayMongo, new card: keep it for next time (saved once the payment succeeds). */
  saveCard?: boolean;
}

/** Who bears the payment gateway's processing fee (PayMongo, Stripe...). */
export type GatewayFeePayer = 'CUSTOMER' | 'ORGANIZATION' | 'PLATFORM';

export interface GatewayFeeSetting {
  /** 0-100, up to two decimals. */
  percentage: number;
  /** Minor units + currency; amount 0 means no flat part. */
  flatAmount: Money | null;
  payer: GatewayFeePayer;
  /** The whole rate for a card issued abroad; null when a foreign card costs the domestic rate. */
  foreignPercentage?: number | null;
  foreignFlatAmount?: Money | null;
  updatedAt?: string | null;
}

/** Body of PUT /payment-gateway-fee: the fee numbers as they are, and who pays. */
export interface GatewayFeeRequest {
  percentage: number;
  /** Leave out for no fixed amount. */
  flatAmount?: Money;
  payer: GatewayFeePayer;
  /** Foreign card rate; leave both out and a foreign card costs the domestic rate. */
  foreignPercentage?: number;
  foreignFlatAmount?: Money;
}

/** The fee setting next to what the payment gateway really charged on its latest paid payments. */
export interface GatewayFeeCheck {
  /** PAYMONGO, or MOCK outside PayMongo mode (no samples then). */
  provider: string;
  configured: {
    percentage: number;
    flatAmount: Money | null;
    payer: GatewayFeePayer;
    foreignPercentage?: number | null;
    foreignFlatAmount?: Money | null;
  };
  samples: {
    paymentId: string;
    amount: Money;
    fee: Money;
    foreignFee: Money;
    totalFee: Money;
    netAmount: Money;
    effectivePercent: number;
    sourceType: string;
    cardBrand: string | null;
    cardCountry: string | null;
    /** DOMESTIC (issued in the Philippines) or FOREIGN: decides which configured rate the payment is compared with. */
    cardOrigin?: 'DOMESTIC' | 'FOREIGN' | null;
    paidAt: string | null;
    /** DOMESTIC_CARD (3.5% + PHP 15.00), INTERNATIONAL_CARD (4.5% + PHP 15.00) or null when neither fits. */
    matchedRate: string | null;
    expectedWithConfigured: Money;
    differenceFromConfigured: Money;
    matchesConfigured: boolean;
  }[];
  allSamplesMatchConfigured: boolean;
  /** The rate of the newest recognised payment. */
  suggestedSetting: { basedOn: string; percentage: number; flatAmount: Money | null } | null;
  note?: string | null;
}

/** The wallet organizers are paid from (PayMongo, or a simulated one in mock mode). Admin only. */
export interface PayoutWallet {
  /** PAYMONGO, or MOCK outside PayMongo mode. */
  provider: string;
  id: string;
  /** PayMongo's word; only an "activated" wallet can send. */
  status: string;
  activated: boolean;
  livemode: boolean;
  balance: { available: Money; pending: Money };
  /** An amount of 999999999999999999 means PayMongo sets no limit. */
  limits: { balance: Money; inwardDaily: Money; inwardMonthly: Money; outwardDaily: Money; outwardMonthly: Money };
  usage: { inwardDaily: Money; inwardMonthly: Money; outwardDaily: Money; outwardMonthly: Money };
  account: { provider: string; accountName: string; accountNumber: string; currency: string } | null;
  updatedAt?: string | null;
  /** True when this is the wallet named in the API's PAYMONGO_WALLET_ACCOUNT_NUMBER; null when nothing is set to compare. */
  matchesConfiguredAccount?: boolean | null;
}

export interface PayoutCard {
  id: UUID;
  organizationId: UUID;
  holderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  primary: boolean;
  /** A customer's saved card: false when it must be typed again (it was saved before the provider kept it). */
  canChargeAgain?: boolean;
  createdAt: string;
}

export interface PayoutCardRequest {
  holderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  /** What the payment gateway returned for the card (the demo gateway takes tok_<brand>). */
  paymentToken: string;
  primary: boolean;
}

export interface EligiblePayoutItem {
  organizationId: UUID;
  organizationName: string;
  eventId: UUID | null;
  eventTitle: string | null;
  eligible: Money;
  status: 'READY' | 'ON_HOLD';
  /** Why it is on hold (e.g. "Pending refunds"). */
  holdReason?: string | null;
}

export interface EligiblePayouts {
  summary: { eligibleOrganizations: number; eligibleAmount: Money; onHold: Money };
  items: EligiblePayoutItem[];
}

export interface PayoutBatchRequest {
  periodStart: string;
  periodEnd: string;
  items: { organizationId: UUID; eventId: UUID | null }[];
}

export interface PayoutGenerateRequest {
  /** First day included (UTC). */
  periodStart: string;
  /** Last day included (UTC); not in the future. */
  periodEnd: string;
}

/** Fields of a promo code that can be changed; leave a field out to keep it. 0 clears a usage limit. */
export interface PromoCodeUpdateRequest {
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  applicableTicketTypeIds?: UUID[];
  usageLimitTotal?: number;
  usageLimitPerBuyer?: number;
  validFrom?: string;
  validUntil?: string;
}

export type DisputeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

/** A problem a customer reported with an order or a ticket. RESOLVED and DISMISSED are final. */
export interface Dispute {
  id: UUID;
  orderId: UUID | null;
  ticketId: UUID | null;
  raisedBy: UUID;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: UUID | null;
}

/** Body of PATCH /disputes/{id} (admin): both optional. */
export interface DisputeUpdateRequest {
  status?: DisputeStatus;
  resolution?: string;
}

/** Body of POST /disputes: an order and/or a ticket, and what went wrong (up to 1000 characters). */
export interface DisputeCreateRequest {
  orderId?: UUID;
  ticketId?: UUID;
  reason: string;
}

export interface FinancePayoutTotal {
  count: number;
  net: Money;
}
/** The payouts created in the period, by status. */
export interface FinancePayouts {
  scheduled: FinancePayoutTotal;
  processing: FinancePayoutTotal;
  paid: FinancePayoutTotal;
  failed: FinancePayoutTotal;
}

/** GET /analytics/platform/finance (admin): the platform's money for a period. */
export interface FinanceSummary {
  from: string;
  to: string;
  currency: string;
  /** Other currencies with orders in the period, left out of every figure. */
  otherCurrencies: string[];
  orders: { count: number; refunded: number };
  sales: { gross: Money; refunds: Money; net: Money };
  platform: { feeIncome: Money; gatewayCostBorne: Money; netIncome: Money };
  gatewayFees: { charged: Money; paidByCustomer: Money; borneByOrganization: Money; borneByPlatform: Money; foreignCardOrders: number };
  organizers: { share: Money; paidOut: Money; inPayouts: Money; owedNotYetInPayout: Money };
  payouts: FinancePayouts;
}

/** GET /organizations/{id}/finance (owner or admin): the organization's own income, never the platform's figures. */
export interface OrganizationFinance {
  organizationId: UUID;
  /** The event the figures are limited to (null when not filtered). */
  eventId?: UUID | null;
  from: string;
  to: string;
  currency: string;
  otherCurrencies: string[];
  orders: number;
  sales: { gross: Money; refunds: Money; net: Money };
  deductions: { platformFee: Money; gatewayFee: Money; total: Money };
  income: Money;
  paidOut: Money;
  inPayouts: Money;
  owedNotYetInPayout: Money;
  payouts: FinancePayouts;
}

export type EarningsInterval = 'DAY' | 'MONTH';
/** One bar of the earnings chart: the organization's income for a day ("2026-10-15") or a month ("2026-10"). */
export interface EarningsPoint {
  period: string;
  earnings: Money;
}
/** GET /organizations/{id}/finance/earnings: every day or month of the range, oldest first (0 when empty). */
export interface OrganizationEarnings {
  interval: EarningsInterval;
  from: string;
  to: string;
  currency: string;
  eventId?: UUID | null;
  points: EarningsPoint[];
}

/** One line of GET /organizations/{id}/transactions (newest first). */
export interface OrgTransaction {
  id: UUID;
  type: 'SALE' | 'REFUND' | 'PAYOUT';
  occurredAt: string;
  description: string;
  eventTitle?: string | null;
  orderId?: UUID | null;
  /** What the buyer paid (0 for a payout). */
  gross: Money;
  /** Platform and gateway fees taken from it. */
  fees: Money;
  /** What it adds to (or, negative, takes from) the organization: a refund and a payout are negative. */
  net: Money;
  status?: string | null;
}

export type NotificationType =
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT_RECEIPT'
  | 'EVENT_REMINDER'
  | 'EVENT_CHANGE'
  | 'EVENT_CANCELLATION'
  | 'WAITLIST_AVAILABILITY'
  | 'REFUND_CONFIRMATION'
  | 'DISPUTE_RESOLVED'
  | 'ACCOUNT_MODERATION_ACTION';

/** One notification sent to the signed-in user (GET /users/me/notifications). The API sends the kind, not the wording. */
export interface AppNotification {
  id: UUID;
  type: NotificationType;
  channel: 'EMAIL' | 'SMS' | 'PUSH';
  /** What it is about: "Order", "Event", "Refund", "Dispute", "WaitlistEntry" or "ModerationAction". */
  relatedObjectType: string | null;
  relatedObjectId: UUID | null;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
}
