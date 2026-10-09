import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { ApplyOrganizerPage } from './pages/ApplyOrganizerPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { CartPage } from './pages/CartPage';
import { AdminOrganizationsPage } from './pages/admin/AdminOrganizationsPage';
import { AdminPayoutsPage } from './pages/admin/AdminPayoutsPage';
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
import { TeamPage } from './pages/organizer/TeamPage';
import { ManageEventsPage } from './pages/organizer/ManageEventsPage';
import { TicketDesignerPage } from './pages/organizer/TicketDesignerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/updates" element={<EventLandingPage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route path="cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="orders/:orderId" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="apply" element={<RequireAuth><ApplyOrganizerPage /></RequireAuth>} />

        <Route path="admin/posts" element={<RequireAuth><AdminPostsPage /></RequireAuth>} />
        <Route path="admin/organizations" element={<RequireAuth><AdminOrganizationsPage /></RequireAuth>} />
        <Route path="admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
        <Route path="admin/payouts" element={<RequireAuth><AdminPayoutsPage /></RequireAuth>} />
        <Route path="manage" element={<RequireAuth><ManageEventsPage /></RequireAuth>} />
        <Route path="manage/team" element={<RequireAuth><TeamPage /></RequireAuth>} />
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
