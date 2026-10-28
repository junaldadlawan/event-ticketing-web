import { Tabs } from './Tabs';

/** The two tabs of "Venues & seat layouts": the places events happen in, and the seating plans their reserved tickets copy from. */
export function VenueTabs() {
  return (
    <Tabs
      label="Venues and seat layouts"
      items={[
        { key: 'venues', label: 'Venues', to: '/manage/venues' },
        { key: 'layouts', label: 'Seat layouts', to: '/manage/layouts' },
      ]}
    />
  );
}
