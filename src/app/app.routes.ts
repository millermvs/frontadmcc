import { Routes } from '@angular/router';
import { Dashboard } from './components/pages/dashboard/dashboard';

export const routes: Routes = [
    {
        path: 'pages/dashboard',
        component: Dashboard
    },

    {
        path: '', pathMatch: 'full', redirectTo: 'pages/dashboard'
    }
];
