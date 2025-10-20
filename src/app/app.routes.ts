import { Routes } from '@angular/router'
import { TitulosReceberComponent } from './pages/titulos-receber/titulos-receber.component'
import { TimelineRecebimentoComponent } from './pages/timeline-recebimento/timeline-recebimento.component'

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: TimelineRecebimentoComponent },
  { path: 'titulos', component: TitulosReceberComponent },
]
