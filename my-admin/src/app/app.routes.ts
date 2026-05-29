import { Routes, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

/**
 * Auth Guard - Bảo vệ các route yêu cầu đăng nhập
 */
const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Lưu URL người dùng muốn truy cập
  localStorage.setItem('redirectUrl', state.url);
  
  // Chuyển về trang login
  router.navigate(['/login']);
  return false;
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login').then(m => m.Login)
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'products',
        loadComponent: () => import('./productsmanage/productsmanage').then(m => m.ProductsManage)
      },
      {
        path: 'orders',
        loadComponent: () => import('./ordersmanage/ordersmanage').then(m => m.OrdersManage)
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./orderdetail/orderdetail').then(m => m.OrderDetail)
      },
      {
        path: 'customers',
        loadComponent: () => import('./customersmanage/customersmanage').then(m => m.CustomersManage)
      },
      {
        path: 'customers/:id',
        loadComponent: () => import('./customerdetail/customerdetail').then(m => m.CustomerDetail)
      },
      {
        path: 'promotions',
        loadComponent: () => import('./promotionmanage/promotionmanage').then(m => m.PromotionManage)
      },
      {
        path: 'posts',
        loadComponent: () => import('./blogmanage/blog').then(m => m.Blog)
      },
      {
        path: 'consultations',
        loadComponent: () => import('./consultationmanage/consultationmanage').then(m => m.ConsultationManage)
      },
      {
        path: 'consultations/:sku',
        loadComponent: () => import('./consultationdetail/consultationdetail').then(m => m.ConsultationDetail)
      },
      {
        path: 'settings',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard)
      }
    ]
  }
];
