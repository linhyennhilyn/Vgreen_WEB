import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { RegisterPhone } from './auth/register-phone/register-phone';
import { OtpComponent } from './auth/otp/otp';
import { RegisterPassword } from './auth/register-password/register-password';
import { ForgotPasswordPhone } from './auth/forgot-password-phone/forgot-password-phone';
import { ForgotPasswordReset } from './auth/forgot-password-reset/forgot-password-reset';
import { OrderComponent } from './order/order';
import { CartComponent } from './cart/cart';
import { PersonalInformation } from './account/personal-information/personal-information';
import { ProductListComponent } from './product/product-list/product-list';
import { ProductDetailComponent } from './product/product-detail/product-detail';
import { Home } from './home/home';
import { Blog } from './vg-blog/blog/blog';
import { BlogDetail } from './vg-blog/blog-detail/blog-detail';
import { AboutComponent } from './about/about';
import { Policy } from './policy/policy';
import { Support } from './support/support';
import { NotificationComponent } from './account/notification/notification';
import { Wishlist } from './account/wishlist/wishlist';
import { AccountLayout } from './account/account-layout/account-layout';
import { OrdersComponent } from './account/orders/orders';
import { ReviewsComponent } from './account/reviews/reviews';
import { AddressComponent } from './account/address/address';
import { ReturnManagementComponent } from './account/return-management/return-management';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: Home, title: 'Trang chủ - VGreen' },
  { path: 'login', component: Login, title: 'Đăng nhập - VGreen' },
  { path: 'register', component: RegisterPhone, title: 'Đăng ký - VGreen' },
  { path: 'register/otp', component: OtpComponent, title: 'Xác thực OTP - VGreen' },
  { path: 'register/password', component: RegisterPassword, title: 'Tạo mật khẩu - VGreen' },
  { path: 'forgot-password', component: ForgotPasswordPhone, title: 'Quên mật khẩu - VGreen' },
  { path: 'forgot-password/otp', component: OtpComponent, title: 'Xác thực OTP - VGreen' },
  {
    path: 'forgot-password/reset',
    component: ForgotPasswordReset,
    title: 'Đặt lại mật khẩu - VGreen',
  },
  {
    path: 'personal-information',
    component: PersonalInformation,
    title: 'Thông tin cá nhân - VGreen',
  },
  { path: 'cart', component: CartComponent, title: 'Giỏ hàng - VGreen' },
  { path: 'order', component: OrderComponent, title: 'Đặt hàng - VGreen' },
  {
    path: 'blog',
    component: Blog,
    title: 'Blog - VGreen',
  },
  {
    path: 'blog/:id',
    component: BlogDetail,
    // Title sẽ được set động trong component
  },
  {
    path: 'about',
    component: AboutComponent,
    title: 'Về chúng tôi - VGreen',
  },
  {
    path: 'policy',
    component: Policy,
    title: 'Chính sách & Điều khoản - VGreen',
  },
  {
    path: 'support',
    component: Support,
    title: 'Hỗ trợ khách hàng - VGreen',
  },
  {
    path: 'account',
    component: AccountLayout,
    children: [
      {
        path: '',
        redirectTo: 'notifications',
        pathMatch: 'full',
      },
      {
        path: 'profile',
        component: PersonalInformation,
        title: 'Tài khoản cá nhân - VGreen',
      },
      {
        path: 'orders',
        component: OrdersComponent,
        title: 'Quản lý đơn hàng - VGreen',
      },
      {
        path: 'notifications',
        component: NotificationComponent,
        title: 'Thông báo - VGreen',
      },
      {
        path: 'reviews',
        component: ReviewsComponent,
        title: 'Đánh giá đơn hàng - VGreen',
      },
      {
        path: 'wishlist',
        component: Wishlist,
        title: 'Danh sách yêu thích - VGreen',
      },
      {
        path: 'address',
        component: AddressComponent,
        title: 'Sổ địa chỉ - VGreen',
      },
      {
        path: 'return-management',
        component: ReturnManagementComponent,
        title: 'Quản lý đổi trả - VGreen',
      },
    ],
  },
  { path: 'products', component: ProductListComponent, title: 'Sản phẩm - VGreen' },
  { path: 'product-list', component: ProductListComponent, title: 'Danh sách sản phẩm - VGreen' },
  {
    path: 'product-detail/:id',
    component: ProductDetailComponent,
    title: 'Chi tiết sản phẩm - VGreen',
  },
  { path: '**', redirectTo: '/home' },
];
