# Graph Report - event-ticketing-frontend  (2026-10-16)

## Corpus Check
- 119 files · ~87,590 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 1016 nodes · 3501 edges · 41 communities (39 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- API Clients and App Core
- Events, Posts and Ticket Types
- Checkout, Payouts and Wallet
- Saved Cards and Orgs
- Ticket Design Helpers
- Ticket Canvas Geometry
- Ticket Text Fields
- Package Dependencies
- Designer Icons
- Gateway and Platform Fees
- Ticket Designer Page
- Frontend Rules (CLAUDE.md)
- Auto-fit and Background
- Canvas Interaction
- API Client and Errors
- Form Submit Handlers
- Birthdate and Password Fields
- Ticket Types Table
- Categories, Promos, Templates
- TypeScript Config
- Post Composer and Uploads
- Auth Screens
- Theme Toggle
- Cart and Event Search
- Auth Dialog
- View Mode and Back Button
- Manage Permissions
- View Mode Context
- Phone Field
- Unsaved Changes
- Background Menu Icons
- Finance Types and Statement
- Popover
- View Switcher
- Delete Event Dialog
- Notification Bell
- Earnings Chart
- Ticket Size Icons
- Scratch Script
- Stored Flags
- Ticket Viewer

## God Nodes (most connected - your core abstractions)
1. `TicketDesignerPage()` - 129 edges
2. `errorMessage()` - 106 edges
3. `ErrorBox()` - 84 edges
4. `react` - 67 edges
5. `useAsync()` - 59 edges
6. `Icon()` - 56 edges
7. `Spinner()` - 52 edges
8. `useAuth()` - 43 edges
9. `Empty()` - 42 edges
10. `formatMoney()` - 40 edges

## Surprising Connections (you probably didn't know these)
- `Scope: this repo only rule` --conceptually_related_to--> `API prompt: PATCH /posts/{postId}`  [INFERRED]
  CLAUDE.md → docs/api-post-edit-prompt.md
- `Frontend must not lie about the API rule` --conceptually_related_to--> `API prompt: organization approvedAt`  [INFERRED]
  CLAUDE.md → docs/api-organization-approved-at-prompt.md
- `API prompt: GET /organizations/mine` --references--> `event-ticketing-api (Spring Boot backend)`  [EXTRACTED]
  docs/api-my-organizations-prompt.md → README.md
- `API prompt: organization approvedAt` --references--> `event-ticketing-api (Spring Boot backend)`  [EXTRACTED]
  docs/api-organization-approved-at-prompt.md → README.md
- `API prompt: ticket template designer` --references--> `event-ticketing-api (Spring Boot backend)`  [EXTRACTED]
  docs/api-ticket-designer-prompt.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **API change-request prompts kept in docs/** — docs_api_admin_assign_members_prompt_admin_assign_members, docs_api_my_organizations_prompt_my_organizations_endpoint, docs_api_organization_approved_at_prompt_approved_at, docs_api_post_edit_prompt_post_edit_endpoint, docs_api_post_picture_prompt_post_picture, docs_api_posts_and_avatar_prompt_posts_and_avatar, docs_api_promo_code_management_prompt_promo_code_management, docs_api_ticket_designer_prompt_ticket_designer, docs_api_ticket_type_organizer_only_prompt_ticket_type_organizer_only, docs_api_user_account_status_prompt_user_account_status [EXTRACTED 1.00]
- **Posts feature API prompt series** — docs_api_posts_and_avatar_prompt_posts_and_avatar, docs_api_post_edit_prompt_post_edit_endpoint, docs_api_post_picture_prompt_post_picture, posts_feature [EXTRACTED 1.00]

## Communities (41 total, 2 thin omitted)

### Community 0 - "API Clients and App Core"
Cohesion: 0.05
Nodes (130): react, react-router-dom, adminUserApi, analyticsApi, disputeApi, moderationApi, orderApi, organizationApi (+122 more)

### Community 1 - "Events, Posts and Ticket Types"
Cohesion: 0.08
Nodes (50): eventApi, postApi, ticketTypeApi, waitlistApi, Event, TicketType, useAuthDialog(), useCanManage() (+42 more)

### Community 2 - "Checkout, Payouts and Wallet"
Cohesion: 0.05
Nodes (61): RFC-7807, checkoutApi, payoutApi, payoutCardApi, payoutWalletApi, TemplateDesign, ticketApi, AccountStatus (+53 more)

### Community 3 - "Saved Cards and Orgs"
Cohesion: 0.09
Nodes (47): paymentMethodApi, OrganizationDocument, PayoutCardRequest, useCart(), AddCardForm(), submit(), CardCalls, NewCard (+39 more)

### Community 4 - "Ticket Design Helpers"
Cohesion: 0.08
Nodes (43): downloadBlob(), codeShape(), designFromTemplate(), isItemUnit(), isSizeUnit(), pxToUnitText(), sizeText(), TicketDesignerPage() (+35 more)

### Community 5 - "Ticket Canvas Geometry"
Cohesion: 0.07
Nodes (48): ALIGN_SHIFT, ANCHOR_SIDE, BackgroundFitMode, BG_WIDTH, boundingSize(), Box, boxFromCorner(), CanvasSelection (+40 more)

### Community 6 - "Ticket Text Fields"
Cohesion: 0.07
Nodes (45): DynamicTextFieldKey, StaticTextFieldKey, TextFieldAlign, TextFieldKey, ALIGNS, breaksFromEdit(), clamp(), clampField() (+37 more)

### Community 7 - "Package Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, jsqr, qrcode, react, react-dom, react-router-dom, @stripe/stripe-js, devDependencies (+27 more)

### Community 8 - "Designer Icons"
Cohesion: 0.11
Nodes (34): AlignCenterIcon(), AlignLeftIcon(), AlignRightIcon(), AutoFitIcon(), BarcodeIcon(), BoldIcon(), BringFrontIcon(), ChevronDownIcon() (+26 more)

### Community 9 - "Gateway and Platform Fees"
Cohesion: 0.09
Nodes (29): gatewayFeeApi, platformFeeApi, FeePayer, GatewayFeePayer, GatewayFeeRequest, GatewayFeeSetting, Money, PlatformFeeRule (+21 more)

### Community 10 - "Ticket Designer Page"
Cohesion: 0.07
Nodes (30): EyeIcon(), RulerIcon(), useUnsavedChanges(), ACCEPTED_TYPES, ALIGNMENTS, CODE_TYPES, FIT_OPTIONS, formatInUnit() (+22 more)

### Community 11 - "Frontend Rules (CLAUDE.md)"
Cohesion: 0.09
Nodes (24): Dev commands (npm run dev, tsc, build), Frontend CLAUDE.md guidance, API prompt: admin assigns organization members, API prompt: GET /organizations/mine, API prompt: organization approvedAt, API prompt: PATCH /posts/{postId}, API prompt: post picture (imageUrl), API prompt: posts and profile avatar (+16 more)

### Community 12 - "Auto-fit and Background"
Cohesion: 0.12
Nodes (23): BackgroundFit, CodePlacement, TextField, AutoFitResult, findBlankArea(), loadImage(), PctRect, CODE_ASPECT (+15 more)

### Community 13 - "Canvas Interaction"
Cohesion: 0.18
Nodes (23): canBreakLines(), clampBackground(), gridStep(), TicketCanvas(), beginFieldMove(), beginMove(), beginResize(), beginRotate() (+15 more)

### Community 14 - "API Client and Errors"
Cohesion: 0.14
Nodes (19): api(), ApiError, buildUrl(), friendlyMessage(), onSessionExpired(), Query, refreshAccessToken(), RequestOptions (+11 more)

### Community 15 - "Form Submit Handlers"
Cohesion: 0.11
Nodes (22): errorMessage(), act(), onSubmit(), submit(), done(), runApprove(), RenameForm(), submit() (+14 more)

### Community 16 - "Birthdate and Password Fields"
Cohesion: 0.15
Nodes (15): BirthdateField(), MONTHS, parse(), PasswordStrength(), EditableRow(), submit(), ProfilePage(), changePassword() (+7 more)

### Community 17 - "Ticket Types Table"
Cohesion: 0.15
Nodes (14): RowMenu(), ticketStatus(), TicketTypes(), cancelDrag(), cardUnder(), confirmDelete(), endDrag(), moveBy() (+6 more)

### Community 18 - "Categories, Promos, Templates"
Cohesion: 0.14
Nodes (15): categoryApi, promoApi, ticketTemplateApi, Category, PromoCode, PromoCodeCreateRequest, TicketTypeKind, TicketTypeUpdateRequest (+7 more)

### Community 19 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 20 - "Post Composer and Uploads"
Cohesion: 0.20
Nodes (15): uploadApi, PostKind, PostComposer(), onSubmit(), onSubmit(), discountText(), PromoCodesDialog(), blankForm() (+7 more)

### Community 21 - "Auth Screens"
Cohesion: 0.32
Nodes (12): AuthSky(), QrIcon(), TicketIcon(), LoginPanel(), PanelProps, RegisterPanel(), onSubmit(), birthDateError() (+4 more)

### Community 22 - "Theme Toggle"
Cohesion: 0.18
Nodes (6): applyPreference(), OPTIONS, readPreference(), svgProps, ThemePreference, ThemeToggle()

### Community 23 - "Cart and Event Search"
Cohesion: 0.23
Nodes (11): cartApi, EventSearch, ManagedEventSearch, PageQuery, Cart, CheckoutStart, EventStatus, Order (+3 more)

### Community 24 - "Auth Dialog"
Cohesion: 0.21
Nodes (9): AuthDialogContext, AuthDialogProvider(), AuthDialogValue, Fill, Mode, TestUsers(), TEST_GROUPS, TEST_USERS (+1 more)

### Community 25 - "View Mode and Back Button"
Cohesion: 0.30
Nodes (8): useViewMode(), BackButton(), goBack(), parentPath(), CartIcon(), Layout(), useUnsavedChangesApi(), isNewAccount()

### Community 26 - "Manage Permissions"
Cohesion: 0.24
Nodes (10): cache, canManageOrg(), hostCache, hostsAnything(), MANAGING_ROLES, orgPosition(), positionCache, useIsHost() (+2 more)

### Community 27 - "View Mode Context"
Cohesion: 0.28
Nodes (6): react-dom, read(), ViewModeContext, ViewModeProvider(), ViewModeValue, CartProvider()

### Community 28 - "Phone Field"
Cohesion: 0.36
Nodes (6): PhoneField(), COUNTRIES, Country, guessCountry(), splitPhone(), ZONES

### Community 29 - "Unsaved Changes"
Cohesion: 0.25
Nodes (5): DiscardDialog(), UnsavedChangesApi, UnsavedChangesContext, UnsavedChangesProvider(), UnsavedItem

### Community 30 - "Background Menu Icons"
Cohesion: 0.25
Nodes (8): CheckIcon(), GridLinesIcon(), LinkIcon(), UploadIcon(), autoGridPx(), BackgroundMenu(), GridMenu(), gridPxFor()

### Community 31 - "Finance Types and Statement"
Cohesion: 0.43
Nodes (6): OrganizationFinance, OrgTransaction, amount(), cell(), row(), statementCsv()

### Community 32 - "Popover"
Cohesion: 0.38
Nodes (6): Popover(), onMove(), onPointerDown(), place(), toggle(), UnitPicker()

### Community 33 - "View Switcher"
Cohesion: 0.40
Nodes (3): ViewMode, optionsFor(), ViewSwitcher()

### Community 34 - "Delete Event Dialog"
Cohesion: 0.53
Nodes (5): COPY, DeleteEventDialog(), PauseIcon(), PlayIcon(), TrashIcon()

### Community 35 - "Notification Bell"
Cohesion: 0.53
Nodes (4): BellIcon(), NotificationBell(), readId(), useGatewayFeeAlert()

### Community 36 - "Earnings Chart"
Cohesion: 0.40
Nodes (4): EarningsPoint, MONTHS, PAD, periodLabel()

### Community 37 - "Ticket Size Icons"
Cohesion: 0.40
Nodes (5): HeightIcon(), TicketSizeIcon(), WidthIcon(), TicketMenu(), unitToPx()

### Community 39 - "Stored Flags"
Cohesion: 0.50
Nodes (3): useStoredFlag(), useStoredString(), set()

## Knowledge Gaps
- **12 isolated node(s):** `@types/qrcode`, `@types/react`, `@types/react-dom`, `typescript`, `RFC-7807` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 209 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `API Clients and App Core` to `Events, Posts and Ticket Types`, `Checkout, Payouts and Wallet`, `Saved Cards and Orgs`, `Ticket Canvas Geometry`, `Package Dependencies`, `Designer Icons`, `Gateway and Platform Fees`, `Ticket Designer Page`, `Auto-fit and Background`, `API Client and Errors`, `Birthdate and Password Fields`, `Categories, Promos, Templates`, `Post Composer and Uploads`, `Auth Screens`, `Theme Toggle`, `Cart and Event Search`, `Auth Dialog`, `View Mode and Back Button`, `Manage Permissions`, `View Mode Context`, `Phone Field`, `Unsaved Changes`, `View Switcher`, `Delete Event Dialog`, `Notification Bell`, `Ticket Viewer`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `TicketDesignerPage()` (e.g. with `onPointerDown()` and `applyTicketSize()`) actually correct?**
  _`TicketDesignerPage()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/qrcode`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Clients and App Core` be split into smaller, more focused modules?**
  _Cohesion score 0.05439941584519898 - nodes in this community are weakly interconnected._
- **Why does `TicketDesignerPage()` connect `Ticket Design Helpers` to `API Clients and App Core`, `Popover`, `Delete Event Dialog`, `Ticket Size Icons`, `Ticket Canvas Geometry`, `Ticket Text Fields`, `Designer Icons`, `Ticket Viewer`, `Ticket Designer Page`, `Stored Flags`, `Auto-fit and Background`, `Canvas Interaction`, `Form Submit Handlers`, `Background Menu Icons`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Should `Events, Posts and Ticket Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07643600180913614 - nodes in this community are weakly interconnected._
- **Why does `errorMessage()` connect `Form Submit Handlers` to `API Clients and App Core`, `Events, Posts and Ticket Types`, `Delete Event Dialog`, `Saved Cards and Orgs`, `Ticket Design Helpers`, `Gateway and Platform Fees`, `Ticket Designer Page`, `Canvas Interaction`, `API Client and Errors`, `Birthdate and Password Fields`, `Ticket Types Table`, `Categories, Promos, Templates`, `Post Composer and Uploads`, `Auth Screens`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._