import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { HQ_HOME, OUTLET_HOME } from '@/components/layout/nav-config';
import { useViewAs } from '@/hooks/use-view-as';
import { MenuAssignmentPage } from '@/pages/hq/assignments/MenuAssignmentPage';
import { MasterMenuPage } from '@/pages/hq/menu/MasterMenuPage';
import { OutletsPage } from '@/pages/hq/outlets/OutletsPage';
import { ReportsPage } from '@/pages/hq/reports/ReportsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

/** "/" opens the home screen of whoever we're viewing as. */
const HomeRedirect = () => {
  const { viewAs } = useViewAs();
  return <Navigate to={viewAs.kind === 'hq' ? HQ_HOME : OUTLET_HOME} replace />;
};

export const App = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<HomeRedirect />} />
      <Route path="hq">
        <Route index element={<Navigate to={HQ_HOME} replace />} />
        <Route path="outlets" element={<OutletsPage />} />
        <Route path="menu" element={<MasterMenuPage />} />
        <Route path="assignments" element={<MenuAssignmentPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="outlet">
        <Route index element={<Navigate to={OUTLET_HOME} replace />} />
        <Route path="sale" element={<PlaceholderPage title="New sale" />} />
        <Route path="inventory" element={<PlaceholderPage title="Inventory" />} />
        <Route path="sales" element={<PlaceholderPage title="Sales history" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);
