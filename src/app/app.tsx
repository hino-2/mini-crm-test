import { Route, Routes } from 'react-router';
import { LoginPage } from '../auth/login-page/login-page';
import { ObjectCardPage } from '../objects/object-card-page/object-card-page';
import { ObjectsListPage } from '../objects/objects-list-page/objects-list-page';
import { TrashPage } from '../trash/trash-page/trash-page';
import { MyTasksPage } from '../tasks/my-tasks-page/my-tasks-page';
import { TaskCardPage } from '../tasks/task-card-page/task-card-page';
import { AppLayout } from './app-layout/app-layout';
import { ROUTE_PATHS } from './app.constants';
import { NotFoundPage } from './not-found-page/not-found-page';
import { GuestOnly, RequireAuth, RequireRole, RoleHomeRedirect } from './route-guards/route-guards';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path={ROUTE_PATHS.login} element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<RoleHomeRedirect />} />
          <Route path={ROUTE_PATHS.objects} element={<ObjectsListPage />} />
          <Route path={ROUTE_PATHS.object} element={<ObjectCardPage />} />
          <Route path={ROUTE_PATHS.task} element={<TaskCardPage />} />
          <Route element={<RequireRole role="executor" redirectTo={ROUTE_PATHS.objects} />}>
            <Route path={ROUTE_PATHS.myTasks} element={<MyTasksPage />} />
          </Route>
          <Route element={<RequireRole role="manager" redirectTo={ROUTE_PATHS.myTasks} />}>
            <Route path={ROUTE_PATHS.trash} element={<TrashPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
