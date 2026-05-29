import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-forgot-password-reset',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './forgot-password-reset.html',
  styleUrls: ['./forgot-password-reset.css'],
})
export class ForgotPasswordReset implements OnInit, OnDestroy {
  @Input() phoneNumber: string = '';
  @Input() isPopupMode: boolean = false;
  @Output() navigateToLogin = new EventEmitter<void>();
  @Output() forgotPasswordSuccess = new EventEmitter<void>();

  password: string = '';
  confirmPassword: string = '';

  passwordError: string = '';
  confirmError: string = '';

  showPassword: boolean = false;
  showConfirm: boolean = false;

  showSuccessMessage: boolean = false;
  isSubmitting: boolean = false; // THÊM FLAG NÀY
  resetSuccessful: boolean = false; // THÊM FLAG NÀY
  private navigateTimeoutId: any = null; // Lưu timeout ID
  private timerSubscription: Subscription | null = null; // Lưu RxJS subscription

  constructor(private router: Router, private http: HttpClient, private ngZone: NgZone) {}

  ngOnInit(): void {
 console.log(' [FORGOT-PASSWORD-RESET] ngOnInit called');
 console.log(' [FORGOT-PASSWORD-RESET] isPopupMode:', this.isPopupMode);
 console.log(' [FORGOT-PASSWORD-RESET] resetSuccessful flag:', this.resetSuccessful);

 // Nếu đang trong quá trình reset thành công, không làm gì cả
    if (this.resetSuccessful) {
 console.log(' [FORGOT-PASSWORD-RESET] Reset thành công, không check điều kiện');
      return;
    }

 // Get phone number from session storage hoặc từ Input (popup mode)
    if (!this.phoneNumber) {
      this.phoneNumber = sessionStorage.getItem('forgotPasswordPhone') || '';
    }
    const otpVerified = sessionStorage.getItem('forgotPasswordOtpVerified');

 console.log(' [FORGOT-PASSWORD-RESET] Phone:', this.phoneNumber);
 console.log(' [FORGOT-PASSWORD-RESET] OTP Verified:', otpVerified);

 // QUAN TRỌNG: Nếu là popup mode và có phoneNumber từ Input, không cần check sessionStorage
    if (this.isPopupMode && this.phoneNumber) {
 console.log(' [FORGOT-PASSWORD-RESET] Popup mode với phoneNumber, cho phép tiếp tục');
      return;
    }

 // Kiểm tra điều kiện truy cập trang cho standalone mode
    if (!this.phoneNumber || !otpVerified) {
 console.log(' [FORGOT-PASSWORD-RESET] Missing phone or OTP verification');
 console.log(' [FORGOT-PASSWORD-RESET] Phone missing:', !this.phoneNumber);
 console.log(' [FORGOT-PASSWORD-RESET] OTP not verified:', !otpVerified);

 // Chỉ redirect nếu ở standalone mode
      if (!this.isPopupMode) {
 console.log(' [FORGOT-PASSWORD-RESET] Redirecting to /forgot-password (standalone mode)');
        this.router.navigate(['/forgot-password']);
      } else {
 console.log(' [FORGOT-PASSWORD-RESET] Popup mode, không redirect');
      }
      return;
    }

 console.log(' [FORGOT-PASSWORD-RESET] Ready for password reset form');
  }

  ngOnDestroy(): void {
 console.log('� [FORGOT-PASSWORD-RESET] ngOnDestroy called - Component đang bị destroy!');

 // Clear sessionStorage KHI component destroy (popup đóng hoặc navigate)
 console.log(' [FORGOT-PASSWORD-RESET] Clear sessionStorage trong ngOnDestroy');
    sessionStorage.removeItem('forgotPasswordPhone');
    sessionStorage.removeItem('forgotPasswordOtpVerified');
    sessionStorage.removeItem('passwordResetCompleted');

    if (this.navigateTimeoutId) {
 console.log(' [FORGOT-PASSWORD-RESET] Clearing timeout:', this.navigateTimeoutId);
      clearTimeout(this.navigateTimeoutId);
    }
    if (this.timerSubscription) {
 console.log(' [FORGOT-PASSWORD-RESET] Unsubscribing timer');
      this.timerSubscription.unsubscribe();
    }
  }

  onPasswordInput(event: any): void {
    const value = event.target.value;
    this.password = value;
    this.passwordError = '';
    this.validatePassword();
    this.validateConfirm(); // Re-validate confirm password when password changes
  }

  onConfirmInput(event: any): void {
    const value = event.target.value;
    this.confirmPassword = value;
    this.confirmError = '';
    this.validateConfirm();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm(): void {
    this.showConfirm = !this.showConfirm;
  }

  validatePassword(): void {
    this.passwordError = '';

    if (this.password.length < 8) {
      this.passwordError = 'Mật khẩu phải có ít nhất 8 ký tự.';
      return;
    }

    if (!/[A-Z]/.test(this.password)) {
      this.passwordError = 'Mật khẩu phải có ít nhất 1 chữ cái in hoa.';
      return;
    }

    if (!/[a-z]/.test(this.password)) {
      this.passwordError = 'Mật khẩu phải có ít nhất 1 chữ cái thường.';
      return;
    }
  }

  validateConfirm(): void {
    if (this.confirmPassword && this.password !== this.confirmPassword) {
      this.confirmError = 'Mật khẩu nhập lại không khớp.';
    } else {
      this.confirmError = '';
    }
  }

  isFormValid(): boolean {
    const hasMinLength = this.password.length >= 8;
    const hasUppercase = /[A-Z]/.test(this.password);
    const hasLowercase = /[a-z]/.test(this.password);
    const passwordsMatch = this.password === this.confirmPassword;
    const noPasswordError = !this.passwordError;
    const noConfirmError = !this.confirmError;

    const isValid =
      hasMinLength &&
      hasUppercase &&
      hasLowercase &&
      passwordsMatch &&
      noPasswordError &&
      noConfirmError;

 // console.log(' Form validation check:');
 // console.log(' Password length >= 8:', hasMinLength);
 // console.log(' Has uppercase:', hasUppercase);
 // console.log(' Has lowercase:', hasLowercase);
 // console.log(' Passwords match:', passwordsMatch);
 // console.log(' No password error:', noPasswordError);
 // console.log(' No confirm error:', noConfirmError);
 // console.log(' Form valid:', isValid);

    return isValid;
  }

  onSubmit(event?: Event): void {
 console.log(' [FORGOT-PASSWORD-RESET] onSubmit() called');

 // Ngăn chặn default form submission để tránh page reload
    if (event) {
      event.preventDefault();
      event.stopPropagation();
 console.log(' [FORGOT-PASSWORD-RESET] event.preventDefault() called');
    }

 // Ngăn submit nhiều lần
    if (this.isSubmitting) {
 console.warn(' [FORGOT-PASSWORD-RESET] Đang submit, bỏ qua request này');
      return;
    }

 // Sử dụng logic reset password đơn giản
    this.resetPassword();
  }

 // Reset password method
  resetPassword(): void {
 console.log(' [FORGOT-PASSWORD-RESET] resetPassword() called');

    if (!this.isFormValid()) {
 console.warn(
        ' [FORGOT-PASSWORD-RESET] Form không hợp lệ, không gửi yêu cầu đặt lại mật khẩu.'
      );
      return;
    }

    if (this.isSubmitting) {
 console.warn(' [FORGOT-PASSWORD-RESET] Đang submit, bỏ qua');
      return;
    }

    const payload = {
      phoneNumber: this.phoneNumber,
      newPassword: this.password,
    };

 console.log(' [FORGOT-PASSWORD-RESET] Gửi request reset password...');
    this.isSubmitting = true;

    this.http.post('/api/auth/reset-password', payload).subscribe({
      next: (response: any) => {
 console.log('� [FORGOT-PASSWORD-RESET] Mật khẩu đã được cập nhật thành công:', response);
 console.log(
          '🔐 [FORGOT-PASSWORD-RESET] Response có token?',
          response.token || response.data?.token
        );
 console.log(
          '🔐 [FORGOT-PASSWORD-RESET] Response có user?',
          response.user || response.data?.user
        );

 // QUAN TRỌNG: Set resetSuccessful TRƯỚC để ngăn ngOnInit chạy lại
        this.resetSuccessful = true;
 console.log('� [FORGOT-PASSWORD-RESET] resetSuccessful = true');

 // QUAN TRỌNG: KHÔNG lưu token vào localStorage cho luồng quên mật khẩu
 console.log(
          '🔐 [FORGOT-PASSWORD-RESET] Không lưu token vào localStorage (đây là luồng quên mật khẩu)'
        );

 // XÓA localStorage để đảm bảo user phải đăng nhập lại
 console.log(' [FORGOT-PASSWORD-RESET] Xóa localStorage.token và localStorage.user...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');

 // Xử lý navigation dựa vào mode
 console.log('═══════════════════════════════════════════════════════════');
 console.log('� [FORGOT-PASSWORD-RESET] Reset password thành công!');
 console.log('� [FORGOT-PASSWORD-RESET] isPopupMode:', this.isPopupMode);
 console.log('═══════════════════════════════════════════════════════════');

        this.isSubmitting = false;

        if (this.isPopupMode) {
 // POPUP MODE: Emit event NGAY, KHÔNG hiển thị message ở đây
 console.log(' [FORGOT-PASSWORD-RESET] POPUP MODE - Emit event NGAY');
 console.log(
            ' [FORGOT-PASSWORD-RESET] forgotPasswordSuccess observers:',
            this.forgotPasswordSuccess.observers.length
          );

 // KHÔNG set showSuccessMessage (giữ UI ổn định)
 // Clear popup state TRƯỚC KHI emit để tránh restore sau khi navigate
          sessionStorage.removeItem('activePopup');
          sessionStorage.removeItem('popupData');
 console.log(' [FORGOT-PASSWORD-RESET] Đã clear popup state');

          try {
            this.forgotPasswordSuccess.emit();
 console.log(
              ' [FORGOT-PASSWORD-RESET] EVENT EMITTED! Auth-popup sẽ chuyển về login...'
            );
          } catch (error) {
 console.error(' [FORGOT-PASSWORD-RESET] Lỗi khi emit event:', error);
          }
        } else {
 // STANDALONE MODE: Hiển thị success message, sau 2s navigate
 console.log(' [FORGOT-PASSWORD-RESET] STANDALONE MODE - Hiển thị success');
          this.showSuccessMessage = true;

 // sessionStorage sẽ clear trong ngOnDestroy khi navigate

 // Delay navigate
          this.timerSubscription = timer(2000).subscribe(() => {
 console.log(' [FORGOT-PASSWORD-RESET] 2s đã qua, navigate to /login');
            this.router.navigate(['/login']).then(() => {
 console.log(' [FORGOT-PASSWORD-RESET] Navigation completed!');
            });
          });
        }

 console.log('═══════════════════════════════════════════════════════════');
      },
      error: (error) => {
 console.error('(x) Lỗi khi cập nhật mật khẩu:', error);
        this.isSubmitting = false;
      },
    });
  }

 // Navigate to login page
  goToLogin(): void {
 // console.log(' Navigate to login clicked');
    if (this.isPopupMode) {
      this.navigateToLogin.emit();
    } else {
      this.router.navigate(['/login']);
    }
  }

 // Popup navigation methods
  onLoginClick(event: Event) {
    event.preventDefault();
    this.navigateToLogin.emit();
  }
}
