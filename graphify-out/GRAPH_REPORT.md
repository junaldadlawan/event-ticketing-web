# Graph Report - graphify-cb62d8  (2026-10-19)

## Corpus Check
- 119 files · ~90,770 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .example 1, .toml 1)

## Summary
- 1060 nodes · 3614 edges · 50 communities (47 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.83)
- Token cost: 105,065 input · 0 output

## Community Hubs (Navigation)
- API Types and Endpoints
- Event and Admin Forms
- Profile and Registration
- Ticket Text Fields
- Ticket Designer State
- Event Landing and Home
- Shared UI and Async
- Canvas Placement Geometry
- Icon Library
- Admin Org and User Management
- Designer Toolbar Menus
- Package Dependencies
- Canvas Interaction
- Cart and Checkout
- Gateway Fee Settings
- React Auth Imports
- Finance Dashboard
- Card Payment Fields
- App Routing
- Payout and Problem Dialogs
- Order Tickets and QR
- Manage Event Page
- Ticket PNG Export
- TypeScript Config
- App Providers Bootstrap
- API Client Core
- Notification Bells
- Organizer API Prompts
- Cart State Types
- Test User Login
- Management Permissions Hooks
- Layout and Navigation
- Theme Toggle
- Project Rules and Setup
- Host Contact Config
- View Mode Switching
- Disputes and Date Format
- Posts and Admin Bypass Prompts
- Upload URL Rules
- Template to Design Mapping
- Payments and Not-Built Items
- Post Composer
- Statement CSV Export
- Real-Size Preview
- Popover and Unit Picker
- Account Status Prompts
- Stored Preference Hooks
- Ticket Viewer
- JWT Auth Refresh
- Money Minor Units

## God Nodes (most connected - your core abstractions)
1. `TicketDesignerPage()` - 129 edges
2. `errorMessage()` - 106 edges
3. `ErrorBox()` - 84 edges
4. `react` - 68 edges
5. `useAsync()` - 59 edges
6. `Icon()` - 56 edges
7. `Spinner()` - 52 edges
8. `useAuth()` - 43 edges
9. `Empty()` - 42 edges
10. `formatDateTime()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `API Change Requests Given as Chat Text` --conceptually_related_to--> `API Prompt: Posts and Avatar`  [AMBIGUOUS]
  CLAUDE.md → docs/api-posts-and-avatar-prompt.md
- `Frontend Must Not Lie About the API` --rationale_for--> `Posts API (sales and announcements)`  [INFERRED]
  CLAUDE.md → docs/api-posts-and-avatar-prompt.md
- `Hiding a Button Is Not Security` --rationale_for--> `Organizer-Only Ticket Type Writes (no admin bypass)`  [INFERRED]
  CLAUDE.md → docs/api-ticket-type-organizer-only-prompt.md
- `Paused Promo Code Rejected at Cart and Checkout` --conceptually_related_to--> `Buyer Features (browse, cart, checkout, orders, tickets)`  [INFERRED]
  docs/api-promo-code-management-prompt.md → README.md
- `GET /organizations/mine` --conceptually_related_to--> `Organizer Features (events, ticket types, orders)`  [INFERRED]
  docs/api-my-organizations-prompt.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Admin bypass / organization permission rules** — docs_api_admin_assign_members_prompt_br_auth_004, docs_api_admin_assign_members_prompt_assignmember_admin_bypass, docs_api_ticket_type_organizer_only_prompt_organizer_only_ticket_type_writes, docs_api_posts_and_avatar_prompt_organizationaccessguard, claude_hiding_button_not_security [INFERRED 0.85]
- **Image fields restricted to own uploads with shared cleanup** — docs_api_posts_and_avatar_prompt_own_upload_url_rule, docs_api_posts_and_avatar_prompt_avatar_url, docs_api_post_picture_prompt_post_image_url, docs_api_ticket_designer_prompt_ticket_template_fields, docs_api_post_picture_prompt_still_referenced_file_cleanup [EXTRACTED 1.00]
- **Posts feature: create/list/delete, edit, picture** — docs_api_posts_and_avatar_prompt_posts_api, docs_api_post_edit_prompt_patch_posts, docs_api_post_picture_prompt_post_image_url [EXTRACTED 1.00]

## Communities (50 total, 3 thin omitted)

### Community 0 - "API Types and Endpoints"
Cohesion: 0.04
Nodes (77): RFC-7807, authApi, payoutCardApi, promoApi, TemplateDesign, ticketApi, AccountStatus, AppNotification (+69 more)

### Community 1 - "Event and Admin Forms"
Cohesion: 0.05
Nodes (57): errorMessage(), categoryApi, act(), CategorySelect(), loadCategories(), useCategories(), onSubmit(), PostComposer() (+49 more)

### Community 2 - "Profile and Registration"
Cohesion: 0.08
Nodes (37): jsqr, qrcode, userApi, AuthSky(), BirthdateField(), MONTHS, parse(), MyQrDialog() (+29 more)

### Community 3 - "Ticket Text Fields"
Cohesion: 0.07
Nodes (47): DynamicTextFieldKey, StaticTextFieldKey, TextFieldAlign, TextFieldKey, ALIGNS, breaksFromEdit(), clamp(), clampField() (+39 more)

### Community 4 - "Ticket Designer State"
Cohesion: 0.08
Nodes (41): downloadBlob(), codeShape(), formatInUnit(), formatNoun(), IconButton(), NumberField(), pctToUnit(), round2() (+33 more)

### Community 5 - "Event Landing and Home"
Cohesion: 0.09
Nodes (33): assetUrl(), postApi, EyeOffIcon(), MoonIcon(), SunIcon(), EventView, GridIcon(), ListIcon() (+25 more)

### Community 6 - "Shared UI and Async"
Cohesion: 0.13
Nodes (34): analyticsApi, eventApi, organizationApi, payoutWalletApi, PayoutStatus, CardManager(), RefreshIcon(), SearchIcon() (+26 more)

### Community 7 - "Canvas Placement Geometry"
Cohesion: 0.10
Nodes (38): CodeType, ALIGN_SHIFT, ANCHOR_SIDE, BackgroundFitMode, BG_WIDTH, boundingSize(), Box, boxFromCorner() (+30 more)

### Community 8 - "Icon Library"
Cohesion: 0.10
Nodes (38): AlignCenterIcon(), AlignLeftIcon(), AlignRightIcon(), AutoFitIcon(), BarcodeIcon(), BoldIcon(), BringFrontIcon(), CopyIcon() (+30 more)

### Community 9 - "Admin Org and User Management"
Cohesion: 0.13
Nodes (29): adminUserApi, moderationApi, OrganizationRole, User, Avatar(), ConfirmDialog(), ErrorBox(), UserPicker() (+21 more)

### Community 10 - "Designer Toolbar Menus"
Cohesion: 0.08
Nodes (34): CheckIcon(), GridLinesIcon(), HeightIcon(), LinkIcon(), TicketSizeIcon(), UploadIcon(), WidthIcon(), autoGridPx() (+26 more)

### Community 11 - "Package Dependencies"
Cohesion: 0.07
Nodes (29): dependencies, jsqr, qrcode, react, react-dom, react-router-dom, @stripe/stripe-js, devDependencies (+21 more)

### Community 12 - "Canvas Interaction"
Cohesion: 0.11
Nodes (31): canBreakLines(), clampBackground(), codeLabel(), DummyBarcodeGraphic(), DummyQrGraphic(), FillArrow(), gridStep(), snapTo() (+23 more)

### Community 13 - "Cart and Checkout"
Cohesion: 0.14
Nodes (25): checkoutApi, paymentMethodApi, confirmCardAction(), CARD_SAVING_AVAILABLE, PAYMONGO_PUBLIC_KEY, STRIPE_PUBLISHABLE_KEY, CartPage(), finishPayMongo() (+17 more)

### Community 14 - "Gateway Fee Settings"
Cohesion: 0.11
Nodes (25): gatewayFeeApi, platformFeeApi, FeePayer, GatewayFeePayer, Money, CARD_FLAT, CARD_RATES, CURRENCIES (+17 more)

### Community 15 - "React Auth Imports"
Cohesion: 0.22
Nodes (14): react, react-router-dom, venueApi, waitlistApi, AuthContext, AuthState, useAuth(), useAuthDialog() (+6 more)

### Community 16 - "Finance Dashboard"
Cohesion: 0.19
Nodes (18): EarningsPoint, EarningsChart(), MONTHS, PAD, periodLabel(), day(), money(), PeriodFields() (+10 more)

### Community 17 - "Card Payment Fields"
Cohesion: 0.32
Nodes (15): @stripe/stripe-js, AddCardForm(), submit(), CardCalls, NewCard, SavedCard, PayMongoCardFields(), StripeCard() (+7 more)

### Community 18 - "App Routing"
Cohesion: 0.24
Nodes (17): App(), StatusBadge(), AdminDisputesPage(), AdminGeneratePayoutPage(), AdminOrganizationsPage(), AdminPayoutsPage(), AdminSettingsPage(), AdminOnly() (+9 more)

### Community 19 - "Payout and Problem Dialogs"
Cohesion: 0.17
Nodes (13): disputeApi, payoutApi, FormDialog(), ReportProblemDialog(), GeneratePayout(), generate(), isoDay(), keyOf() (+5 more)

### Community 20 - "Order Tickets and QR"
Cohesion: 0.21
Nodes (15): orderApi, SuccessBox(), pick(), scan(), BigCountdown(), Countdown(), OrderDetailPage(), TicketCard() (+7 more)

### Community 21 - "Manage Event Page"
Cohesion: 0.18
Nodes (12): ticketTemplateApi, ticketTypeApi, COPY, DeleteEventDialog(), ChevronDownIcon(), GripIcon(), PauseIcon(), PlayIcon() (+4 more)

### Community 22 - "Ticket PNG Export"
Cohesion: 0.18
Nodes (14): AutoFitResult, findBlankArea(), loadImage(), PctRect, CODE_ASPECT, drawBackground(), drawCode(), drawText() (+6 more)

### Community 23 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 24 - "App Providers Bootstrap"
Cohesion: 0.14
Nodes (10): react-dom, setSessionExpiredHandler(), AuthProvider(), CartProvider(), DiscardDialog(), UnsavedChangesApi, UnsavedChangesContext, UnsavedChangesProvider() (+2 more)

### Community 25 - "API Client Core"
Cohesion: 0.21
Nodes (14): api(), API_BASE, ApiError, apiUrl(), buildUrl(), friendlyMessage(), onSessionExpired(), Query (+6 more)

### Community 26 - "Notification Bells"
Cohesion: 0.20
Nodes (13): notificationApi, NotificationType, CustomerNotificationBell(), go(), toggle(), readSeen(), seenKey(), target() (+5 more)

### Community 27 - "Organizer API Prompts"
Cohesion: 0.18
Nodes (12): API Prompt: My Organizations, GET /organizations/mine, OrganizationAccessGuard, API Prompt: Promo Code Management, Paused Promo Code Rejected at Cart and Checkout, Promo Code PATCH / Status / DELETE, API Prompt: Ticket Types Organizer Only, Organizer-Only Ticket Type Writes (no admin bypass) (+4 more)

### Community 28 - "Cart State Types"
Cohesion: 0.22
Nodes (12): cartApi, EventSearch, ManagedEventSearch, PageQuery, Cart, CheckoutPayment, CheckoutStart, EventStatus (+4 more)

### Community 29 - "Test User Login"
Cohesion: 0.19
Nodes (10): AuthDialogContext, AuthDialogProvider(), AuthDialogValue, Fill, Mode, TestUsers(), TEST_GROUPS, TEST_USERS (+2 more)

### Community 30 - "Management Permissions Hooks"
Cohesion: 0.23
Nodes (11): cache, canManageOrg(), hostCache, MANAGING_ROLES, orgPosition(), positionCache, useCanManage(), useIsOrgManager() (+3 more)

### Community 31 - "Layout and Navigation"
Cohesion: 0.28
Nodes (9): useViewMode(), BackButton(), goBack(), parentPath(), SparkleIcon(), CartIcon(), Layout(), useUnsavedChangesApi() (+1 more)

### Community 32 - "Theme Toggle"
Cohesion: 0.18
Nodes (6): applyPreference(), OPTIONS, readPreference(), svgProps, ThemePreference, ThemeToggle()

### Community 33 - "Project Rules and Setup"
Cohesion: 0.20
Nodes (5): Pre-paint Theme Script (et.theme), event-ticketing-api (Spring Boot backend), Netlify Deploy (netlify.toml), VITE_API_BASE_URL Production Build, Vite /api Proxy (VITE_API_TARGET)

### Community 34 - "Host Contact Config"
Cohesion: 0.33
Nodes (7): hostsAnything(), useIsHost(), HostCta(), CONTACT_EMAIL, CONTACT_PHONE, telHref(), DOCUMENT_TYPES

### Community 35 - "View Mode Switching"
Cohesion: 0.24
Nodes (7): read(), ViewMode, ViewModeContext, ViewModeProvider(), ViewModeValue, optionsFor(), ViewSwitcher()

### Community 36 - "Disputes and Date Format"
Cohesion: 0.44
Nodes (9): EventCollection(), DisputesManager(), isTerminal(), ReviewForm(), submit(), short(), TONE, formatDateTime() (+1 more)

### Community 37 - "Posts and Admin Bypass Prompts"
Cohesion: 0.25
Nodes (9): API Prompt: Admin Assign Members, assignMember Admin Bypass (POST /organizations/{orgId}/members), BR-AUTH-004 Admin Bypass Rule, API Prompt: Post Edit, PATCH /posts/{postId}, API Prompt: Posts and Avatar, BusinessAuditLogger, openapi.yaml (API contract) (+1 more)

### Community 38 - "Upload URL Rules"
Cohesion: 0.32
Nodes (8): API Prompt: Post Picture, posts.image_url / Post imageUrl, Still-Referenced Upload File Cleanup, users.avatar_url Profile Picture, Only Own /api/v1/uploads/files/ URLs Accepted, API Prompt: Ticket Designer, PngTicketRenderer / PdfTicketRenderer Rendering Rules, Ticket Template Canvas, Background and Text Fields

### Community 39 - "Template to Design Mapping"
Cohesion: 0.32
Nodes (8): codeTypeOf(), designFromTemplate(), placementOf(), savedBackgroundRect(), savedPlacement(), sizeOf(), addLayout(), designOfLayout()

### Community 40 - "Payments and Not-Built Items"
Cohesion: 0.33
Nodes (5): Checkout with Idempotency-Key, Mock Payment Gateway (tok_fail declined), Automatic Gateway Fee (not built), PayMongo Payment Gateway, Save a Card for Next Time (not built)

### Community 41 - "Post Composer"
Cohesion: 0.33
Nodes (6): uploadApi, Event, PostKind, TicketType, ItemDetails, OnSale

### Community 42 - "Statement CSV Export"
Cohesion: 0.43
Nodes (6): OrganizationFinance, OrgTransaction, amount(), cell(), row(), statementCsv()

### Community 43 - "Real-Size Preview"
Cohesion: 0.48
Nodes (5): CARD_MM, cssPxPerInch(), readScreenInches(), RealSizePreview(), screenPixels()

### Community 44 - "Popover and Unit Picker"
Cohesion: 0.38
Nodes (6): Popover(), onMove(), onPointerDown(), place(), toggle(), UnitPicker()

### Community 45 - "Account Status Prompts"
Cohesion: 0.40
Nodes (5): API Prompt: Organization approvedAt, organizations.approved_at / approvedAt, API Prompt: User Account Status, UserResponse.accountStatus (ACTIVE / SUSPENDED), Admin Self / Last-Admin Guard Rails

### Community 46 - "Stored Preference Hooks"
Cohesion: 0.50
Nodes (3): useStoredFlag(), useStoredString(), set()

## Ambiguous Edges - Review These
- `API Change Requests Given as Chat Text` → `API Prompt: Posts and Avatar`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `@types/qrcode`, `@types/react`, `@types/react-dom`, `typescript`, `RFC-7807` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 215 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `React Auth Imports` to `API Types and Endpoints`, `Event and Admin Forms`, `Profile and Registration`, `Event Landing and Home`, `Shared UI and Async`, `Canvas Placement Geometry`, `Icon Library`, `Admin Org and User Management`, `Designer Toolbar Menus`, `Package Dependencies`, `Cart and Checkout`, `Gateway Fee Settings`, `Finance Dashboard`, `Card Payment Fields`, `App Routing`, `Payout and Problem Dialogs`, `Order Tickets and QR`, `Manage Event Page`, `App Providers Bootstrap`, `Notification Bells`, `Cart State Types`, `Test User Login`, `Management Permissions Hooks`, `Layout and Navigation`, `Theme Toggle`, `Host Contact Config`, `View Mode Switching`, `Disputes and Date Format`, `Post Composer`, `Real-Size Preview`, `Ticket Viewer`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `TicketDesignerPage()` (e.g. with `onPointerDown()` and `applyTicketSize()`) actually correct?**
  _`TicketDesignerPage()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/qrcode`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Types and Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.043670886075949364 - nodes in this community are weakly interconnected._
- **Why does `TicketDesignerPage()` connect `Ticket Designer State` to `Event and Admin Forms`, `Ticket Text Fields`, `Shared UI and Async`, `Canvas Placement Geometry`, `Icon Library`, `Admin Org and User Management`, `Designer Toolbar Menus`, `Real-Size Preview`, `Canvas Interaction`, `Template to Design Mapping`, `Popover and Unit Picker`, `Ticket Viewer`, `Stored Preference Hooks`, `App Routing`, `Manage Event Page`, `Ticket PNG Export`, `App Providers Bootstrap`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `Event and Admin Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.05446853516657853 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `API Change Requests Given as Chat Text` and `API Prompt: Posts and Avatar`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._