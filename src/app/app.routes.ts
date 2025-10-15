import { Routes } from '@angular/router';
import { TitulosReceberComponent } from './pages/titulos-receber/titulos-receber.component';

export const routes: Routes = [
  { path: '', redirectTo: 'titulos', pathMatch: 'full' },
  { path: 'titulos', component: TitulosReceberComponent },
];
