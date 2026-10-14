import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { ApplyOrganizerPage } from './pages/ApplyOrganizerPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CartPage } from './pages/CartPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { AdminGeneratePayoutPage } from './pages/admin/AdminGeneratePayoutPage';
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
import { ProfilePage } from './pages/ProfilePage';
import { CreateEventPage } from './pages/organizer/CreateEventPage';
import { ManageEventPage } from './pages/organizer/ManageEventPage';
import { CustomerPaymentPage } from './pages/CustomerPaymentPage';
import { ManageSettingsPage } from './pages/organizer/ManageSettingsPage';
import { TeamPage } from './pages/organizer/TeamPage';
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
        <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="orders/:orderId" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="profile/payment" element={<RequireAuth><CustomerPaymentPage /></RequireAuth>} />
        <Route path="settings" element={<Navigate to="/profile/payment" replace />} />
        <Route path="apply" element={<RequireAuth><ApplyOrganizerPage /></RequireAuth>} />

        <Route path="admin/posts" element={<RequireAuth><AdminPostsPage /></RequireAuth>} />
        <Route path="admin/organizations" element={<RequireAuth><AdminOrganizationsPage /></RequireAuth>} />
        <Route path="admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
        <Route path="admin/payouts" element={<RequireAuth><AdminPayoutsPage /></RequireAuth>} />
        <Route path="admin/payouts/generate" element={<RequireAuth><AdminGeneratePayoutPage /></RequireAuth>} />
        <Route path="admin/settings" element={<RequireAuth><AdminSettingsPage /></RequireAuth>} />
        <Route path="admin/settings/:section" element={<RequireAuth><AdminSettingsPage /></RequireAuth>} />
        <Route path="manage" element={<RequireAuth><ManageEventsPage /></RequireAuth>} />
        <Route path="manage/team" element={<RequireAuth><TeamPage /></RequireAuth>} />
        <Route path="manage/settings" element={<RequireAuth><ManageSettingsPage /></RequireAuth>} />
        <Route path="manage/new" element={<RequireAuth><CreateEventPage /></RequireAuth>} />
        <Route
          path="manage/events/:eventId"
          element={<RequireAuth><ManageEventPage /></RequireAuth>}
        />
        <Route
          path="manage/events/:eventId/ticket-design"
          element={<RequireAuth><TicketDesignerPage /></RequireAuth>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
