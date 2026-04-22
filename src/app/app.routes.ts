import { Routes } from '@angular/router';
import { AppV1LabelDesignerComponent } from './v1/app.v1.label.designer.comoponent';
import { AppV2LabelDesignerComponent } from './v2/app.v2.label.designer.comoponent';
import { AppV3LabelDesignerComponent } from './v3/app.v3.label.designer.component';

export const routes: Routes = [
    {
        path: 'designer',
        component: AppV2LabelDesignerComponent
    },
    {
        path: 'designer-v1',
        component: AppV1LabelDesignerComponent
    },
    {
        path: 'designer-v3',
        component: AppV3LabelDesignerComponent
    },
    {
        path: '',
        redirectTo: '/designer-v3',
        pathMatch: 'full'
    }
];
