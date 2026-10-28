import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { ApplyOrganizerPage } from './pages/ApplyOrganizerPage';
import { ContactPage } from './pages/ContactPage';
import { VenuesPage } from './pages/organizer/VenuesPage';
import { LayoutEditorPage, PresetEditorPage } from './pages/organizer/LayoutEditorPage';
import { LayoutsPage } from './pages/organizer/LayoutsPage';
import { AdminLayoutPresetsPage } from './pages/admin/AdminLayoutPresetsPage';
import { EventReportPage } from './pages/organizer/EventReportPage';
import { ShareRedirectPage } from './pages/ShareRedirectPage';
import { PostsPage } from './pages/PostsPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CheckoutReturnPage } from './pages/CheckoutReturnPage';
import { CartPage } from './pages/CartPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { AdminGeneratePayoutPage } from './pages/admin/AdminGeneratePayoutPage';
import { AdminDisputesPage } from './pages/admin/AdminDisputesPage';
import { AdminPayoutsPage } from './pages/admin/AdminPayoutsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminPostsPage } from './pages/admin/AdminPostsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventLandingPage } from './pages/EventLandingPage';
import { HomePage } from './pages/HomePage';
import { EventsPage } from './pages/EventsPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ManageEventPage } from './pages/organizer/ManageEventPage';
import { CustomerPaymentPage } from './pages/CustomerPaymentPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ManageFinancePage } from './pages/organizer/ManageFinancePage';
import { ManageSettingsPage } from './pages/organizer/ManageSettingsPage';
import { TeamPage } from './pages/organizer/TeamPage';
import { ScannerPage } from './pages/organizer/ScannerPage';
import { AdminScannerPage } from './pages/admin/AdminScannerPage';
import { AdminOrgChangesPage } from './pages/admin/AdminOrgChangesPage';
import { ManageEventsPage } from './pages/organizer/ManageEventsPage';
import { TicketDesignerPage } from './pages/organizer/TicketDesignerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Home is the landing screen; the event list lives at /events. */}
        <Route index element={<HomePage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/updates" element={<EventLandingPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route path="cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="checkout/return" element={<RequireAuth><CheckoutReturnPage /></RequireAuth>} />
        <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="tickets" element={<RequireAuth><MyTicketsPage /></RequireAuth>} />
        <Route path="orders/:orderId" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="profile/payment" element={<RequireAuth><CustomerPaymentPage /></RequireAuth>} />
        <Route path="profile/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="settings"element={<Navigate to="/profile/payment" replace />} />
        <Route path="s/:code" element={<ShareRedirectPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="apply" element={<RequireAuth><ApplyOrganizerPage /></RequireAuth>} />

        <Route path="admin/posts" element={<RequireAuth><AdminPostsPage /></RequireAuth>} />
        <Route path="admin/organizations" element={<RequireAuth><AdminOrganizationsPage /></RequireAuth>} />
        <Route path="admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
        <Route path="admin/disputes" element={<RequireAuth><AdminDisputesPage /></RequireAuth>} />
        <Route path="admin/payouts" element={<RequireAuth><AdminPayoutsPage /></RequireAuth>} />
        <Route path="admin/payouts/generate" element={<RequireAuth><AdminGeneratePayoutPage /></RequireAuth>} />
        <Route path="admin/settings" element={<RequireAuth><AdminSettingsPage /></RequireAuth>} />
        <Route path="admin/settings/:section" element={<RequireAuth><AdminSettingsPage /></RequireAuth>} />
        <Route path="admin/organization-changes" element={<RequireAuth><AdminOrgChangesPage /></RequireAuth>} />
        <Route path="admin/scanner" element={<RequireAuth><AdminScannerPage /></RequireAuth>} />
        <Route path="manage/scanner" element={<RequireAuth><ScannerPage /></RequireAuth>} />
        <Route path="manage" element={<RequireAuth><ManageEventsPage /></RequireAuth>} />
        <Route path="manage/venues" element={<RequireAuth><VenuesPage /></RequireAuth>} />
        <Route path="manage/layouts" element={<RequireAuth><LayoutsPage /></RequireAuth>} />
        <Route path="manage/layouts/new" element={<RequireAuth><LayoutEditorPage /></RequireAuth>} />
        <Route path="manage/layouts/presets/:presetId" element={<RequireAuth><PresetEditorPage forOrganizer /></RequireAuth>} />
        <Route path="manage/layouts/:layoutId" element={<RequireAuth><LayoutEditorPage /></RequireAuth>} />
        <Route path="admin/layout-presets" element={<RequireAuth><AdminLayoutPresetsPage /></RequireAuth>} />
        <Route path="admin/layout-presets/new" element={<RequireAuth><PresetEditorPage /></RequireAuth>} />
        <Route path="admin/layout-presets/:presetId" element={<RequireAuth><PresetEditorPage /></RequireAuth>} />
        <Route path="manage/team" element={<RequireAuth><TeamPage /></RequireAuth>} />
        <Route path="manage/finance" element={<RequireAuth><ManageFinancePage /></RequireAuth>} />
        <Route path="manage/settings" element={<RequireAuth><ManageSettingsPage /></RequireAuth>} />
        <Route path="manage/settings/:section" element={<RequireAuth><ManageSettingsPage /></RequireAuth>} />
        <Route path="manage/new" element={<RequireAuth><ManageEventsPage /></RequireAuth>} />
        <Route
          path="manage/events/:eventId"
          element={<RequireAuth><ManageEventPage /></RequireAuth>}
        />
        <Route path="manage/events/:eventId/report" element={<RequireAuth><EventReportPage /></RequireAuth>} />
        <Route path="manage/events/:eventId/edit" element={<RequireAuth><ManageEventPage /></RequireAuth>} />
        <Route
          path="manage/events/:eventId/ticket-design"
          element={<RequireAuth><TicketDesignerPage /></RequireAuth>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
