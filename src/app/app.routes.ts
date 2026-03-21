import { Routes } from '@angular/router';
import { Dashboard } from './components/pages/dashboard/dashboard';
import { Equipes } from './components/pages/equipes/equipes';

export const routes: Routes = [
    {
        path: 'pages/dashboard',
        component: Dashboard
    },
    {
        path: 'pages/equipes',
        component: Equipes
    },
    {
        path: '', pathMatch: 'full', redirectTo: 'pages/dashboard'
    }
];
