import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import { AuthPopupService, PopupType } from '../../services/auth-popup.service';
import { Login } from '../login/login';
import { RegisterPhone } from '../register-phone/register-phone';
// TODO: Add popup support for these components
import { ForgotPasswordPhone } from '../forgot-password-phone/forgot-password-phone';
import { OtpComponent } from '../otp/otp';
import { RegisterPassword } from '../register-password/register-password';
import { ForgotPasswordReset } from '../forgot-password-reset/forgot-password-reset';

@Component({
  selector: 'app-auth-popup',
  standalone: true,
  imports: [
    CommonModule,
    Login,
    RegisterPhone,
    OtpComponent,
 // TODO: Add popup support for these components
    ForgotPasswordPhone,
    RegisterPassword,
    ForgotPasswordReset,
  ],
  templateUrl: './auth-popup.html',
  styleUrls: ['./auth-popup.css'],
})
export class AuthPopupComponent implements OnInit, OnDestroy {
  isOpen = false;
  activePopup: PopupType = null;
  popupData: any = null;

  private subscriptions: Subscription[] = [];

  constructor(private authPopupService: AuthPopupService) {}

  ngOnInit() {
 console.log(' [AUTH-POPUP] ngOnInit - Component khởi tạo');

 // Subscribe to popup state changes
    this.subscriptions.push(
      this.authPopupService.getActivePopup().subscribe((popup) => {
 console.log('� [AUTH-POPUP] activePopup CHANGED:', popup);
 console.log('� [AUTH-POPUP] isOpen TRƯỚC:', this.isOpen);

        this.activePopup = popup;
        this.isOpen = popup !== null;

 console.log('� [AUTH-POPUP] isOpen SAU:', this.isOpen);
 console.log('� [AUTH-POPUP] Popup overlay sẽ hiển thị:', this.isOpen ? 'YES' : 'NO');
      })
    );

    this.subscriptions.push(
      this.authPopupService.getPopupData().subscribe((data) => {
 console.log(' [AUTH-POPUP] popupData CHANGED:', data);
        this.popupData = data;
      })
    );
  }

  ngOnDestroy() {
 console.log('� [AUTH-POPUP] ngOnDestroy - Component đang bị destroy!');
 console.log('� [AUTH-POPUP] activePopup tại thời điểm destroy:', this.activePopup);
 console.log('� [AUTH-POPUP] isOpen tại thời điểm destroy:', this.isOpen);
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  onOverlayClick() {
    this.closePopup();
  }

  onEscapeKey() {
    this.closePopup();
  }

  closePopup() {
    this.authPopupService.closePopup();
  }

 // Navigation methods
  navigateToLogin() {
 console.log(' [AUTH-POPUP] navigateToLogin() được gọi');
 console.log(' [AUTH-POPUP] Gọi authPopupService.navigateToLogin()');
    this.authPopupService.navigateToLogin();
 console.log(' [AUTH-POPUP] Đã gọi authPopupService.navigateToLogin()');
  }

  navigateToRegister() {
    this.authPopupService.navigateToRegister();
  }

  navigateToOTP(phoneNumber: string, flowType: 'register' | 'forgot' = 'register') {
    this.authPopupService.navigateToOTP(phoneNumber, flowType);
  }

  navigateToRegisterPassword(phoneNumber: string) {
    this.authPopupService.navigateToRegisterPassword(phoneNumber);
  }

  navigateToForgotPassword() {
    this.authPopupService.navigateToForgotPassword();
  }

  navigateToForgotPasswordReset(phoneNumber: string) {
    this.authPopupService.navigateToForgotPasswordReset(phoneNumber);
  }

 // Success handlers
  onLoginSuccess() {
 console.log(' [AUTH-POPUP] onLoginSuccess ĐƯỢC GỌI!');
    this.closePopup();
 console.log('Login successful!');

 // Reload page to update header with logged-in state
    setTimeout(() => {
 console.log(' [AUTH-POPUP] RELOAD PAGE từ onLoginSuccess');
      window.location.reload();
    }, 300); // Small delay to let popup close animation finish
  }

  onRegisterSuccess() {
 // Không đóng popup ngay, để user thấy success message trong 2 giây
 console.log(' [AUTH-POPUP] onRegisterSuccess ĐƯỢC GỌI (ĐĂNG KÝ)');
 console.log(' [AUTH-POPUP] User đã được tự động đăng nhập');
 console.log(' [AUTH-POPUP] localStorage.token:', localStorage.getItem('token'));
 console.log(' [AUTH-POPUP] localStorage.user:', localStorage.getItem('user'));
 console.log(' [AUTH-POPUP] Sẽ RELOAD PAGE sau 2.3 giây...');

 // Reload page sau 2.3 giây (2s cho success message + 0.3s buffer)
    setTimeout(() => {
 console.log(' [AUTH-POPUP] 2.3 giây đã qua, RELOAD PAGE (ĐĂNG KÝ)');
      window.location.reload();
    }, 2300);
  }

  onForgotPasswordSuccess() {
 console.log('╔═══════════════════════════════════════════════════════════╗');
 console.log('║ [AUTH-POPUP] onForgotPasswordSuccess ĐƯỢC GỌI! ║');
 console.log('╚═══════════════════════════════════════════════════════════╝');
 console.log(' [AUTH-POPUP] localStorage.token:', localStorage.getItem('token'));
 console.log(' [AUTH-POPUP] localStorage.user:', localStorage.getItem('user'));
 console.log(' [AUTH-POPUP] activePopup hiện tại:', this.activePopup);
 console.log(' [AUTH-POPUP] NAVIGATE NGAY LẬP TỨC - KHÔNG CHỜ!');

 // KHÔNG CHỜ - Navigate ngay lập tức!
 console.log('╔═══════════════════════════════════════════════════════════╗');
 console.log('║ [AUTH-POPUP] GỌI navigateToLogin() NGAY! ║');
 console.log('╚═══════════════════════════════════════════════════════════╝');
 console.log(' [AUTH-POPUP] localStorage.token:', localStorage.getItem('token'));
 console.log(' [AUTH-POPUP] localStorage.user:', localStorage.getItem('user'));
 console.log(' [AUTH-POPUP] activePopup trước navigate:', this.activePopup);

    this.navigateToLogin();

 console.log(' [AUTH-POPUP] Đã gọi navigateToLogin()');
 console.log(' [AUTH-POPUP] activePopup sau navigate:', this.activePopup);
  }

 // OTP handlers
  onOtpBack() {
    if (this.popupData?.flowType === 'register') {
      this.navigateToRegister();
    } else if (this.popupData?.flowType === 'forgot') {
      this.navigateToForgotPassword();
    } else {
      this.navigateToLogin();
    }
  }

  onOtpNext(phoneNumber: string) {
    if (this.popupData?.flowType === 'register') {
      this.navigateToRegisterPassword(phoneNumber);
    } else if (this.popupData?.flowType === 'forgot') {
      this.navigateToForgotPasswordReset(phoneNumber);
    }
  }

 // Event handlers for different components
  onRegisterOTP(phoneNumber: string) {
    this.navigateToOTP(phoneNumber, 'register');
  }

  onForgotPasswordOTP(phoneNumber: string) {
    this.navigateToOTP(phoneNumber, 'forgot');
  }
}
