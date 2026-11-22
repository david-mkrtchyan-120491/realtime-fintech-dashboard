import type { Routes } from '@angular/router';
import { Dashboard } from '@pages/dashboard/dashboard';
import { Settings } from '@pages/settings/settings';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: Dashboard,
    title: 'Dashboard · Market Desk',
  },
  {
    path: 'settings',
    component: Settings,
    title: 'Settings · Market Desk',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
