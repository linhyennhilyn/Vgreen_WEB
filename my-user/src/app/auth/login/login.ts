import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { AuthPopupService } from '../../services/auth-popup.service';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit {
  @Input() isPopupMode: boolean = false;
  @Output() navigateToRegister = new EventEmitter<void>();
  @Output() navigateToForgotPassword = new EventEmitter<void>();
  @Output() loginSuccess = new EventEmitter<void>();

  @ViewChild('phoneInput') phoneInputRef!: ElementRef<HTMLInputElement>;

  phoneNumber: string = '';
  password: string = '';
  showPassword: boolean = false;
  phoneError: string = '';
  passwordError: string = '';
  loginError: string = '';
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private toastService: ToastService,
    private authPopupService: AuthPopupService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log(' [LOGIN] ngOnInit - Login component khởi tạo');
    console.log(' [LOGIN] isPopupMode:', this.isPopupMode);

    // Chỉ clear registration/forgot-password keys (KHÔNG clear activePopup!)
    console.log(' [LOGIN] Clear specific sessionStorage keys');
    sessionStorage.removeItem('registerPhone');
    sessionStorage.removeItem('registerOtpVerified');
    sessionStorage.removeItem('registerOtp');
    sessionStorage.removeItem('registrationCompleted');
    sessionStorage.removeItem('forgotPasswordPhone');
    sessionStorage.removeItem('forgotPasswordOtpVerified');
    sessionStorage.removeItem('passwordResetCompleted');

    // Auto-focus vào input số điện thoại khi vào trang
    setTimeout(() => {
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();
      }
    }, 100);

    console.log(' [LOGIN] ngOnInit HOÀN TẤT');
  }

  // Handle phone input
  onPhoneInput(event: any): void {
    this.phoneNumber = event.target.value;
    this.validatePhone();
  }

  // Handle password input
  onPasswordInput(event: any): void {
    this.password = event.target.value;
    this.validatePassword();
  }

  // Phone number validation
  validatePhone(): void {
    const phoneRegex = /^[0-9]{10,11}$/;
    if (this.phoneNumber && !phoneRegex.test(this.phoneNumber)) {
      this.phoneError = 'Số điện thoại không hợp lệ.';
    } else {
      this.phoneError = '';
    }
  }

  // Password validation
  validatePassword(): void {
    if (this.password && this.password.length < 8) {
      this.passwordError = 'Mật khẩu phải có ít nhất 8 ký tự.';
    } else if (this.password && !/(?=.*[A-Z])/.test(this.password)) {
      this.passwordError = 'Mật khẩu phải có ít nhất 1 chữ cái in hoa.';
    } else {
      this.passwordError = '';
    }
  }

  // Clear phone number input
  clearPhone(): void {
    this.phoneNumber = '';
    this.phoneError = '';

    // Focus vào ô input sau khi clear
    setTimeout(() => {
      if (this.phoneInputRef?.nativeElement) {
        this.phoneInputRef.nativeElement.focus();
      }
    }, 0);
  }

  // Toggle password visibility
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // Check if form is valid
  isFormValid(): boolean {
    return (
      this.phoneNumber.length >= 10 &&
      this.password.length >= 8 &&
      !this.phoneError &&
      !this.passwordError
    );
  }

  // Handle form submission
  onSubmit(): void {
    if (!this.isFormValid()) return;

    // Clear previous errors
    this.phoneError = '';
    this.passwordError = '';
    this.loginError = '';
    this.isLoading = true;

    console.log('Đang đăng nhập qua Supabase...', {
      phone: this.phoneNumber,
      password: this.password ? '***' : '',
    });

    this.authService.login({ phoneNumber: this.phoneNumber, password: this.password }).subscribe({
      next: (response) => {
        this.isLoading = false;

        if (response.success && response.data) {
          this.toastService.show('Đăng nhập thành công!', 'success');
          console.log('Đăng nhập Supabase thành công:', response.data.user);

          if (this.isPopupMode) {
            this.loginSuccess.emit();
          } else {
            // Redirect to homepage or dashboard after login
            this.router.navigate(['/']);
          }
        } else {
          console.warn('Đăng nhập Supabase thất bại:', response.message);
          this.loginError = response.message || 'Đăng nhập không thành công';
        }
      },
      error: (error) => {
        console.error('Lỗi đăng nhập Supabase:', error);
        this.isLoading = false;

        if (error.status === 0) {
          this.loginError =
            'Không thể kết nối tới Supabase. Kiểm tra Internet hoặc cấu hình Supabase.';
        } else {
          this.loginError = error.message || 'Lỗi đăng nhập. Vui lòng thử lại.';
        }
      },
    });
  }

  // Popup navigation methods
  onRegisterClick(event: Event) {
    event.preventDefault();
    this.navigateToRegister.emit();
  }

  onForgotPasswordClick(event: Event) {
    event.preventDefault();
    this.navigateToForgotPassword.emit();
  }

  // Social login methods
  onGoogleLogin(): void {
    console.log('� [LOGIN] Google login clicked');
    // TODO: Implement Google OAuth login
    this.toastService.show('Tính năng đăng nhập bằng Google đang được phát triển');
  }

  onFacebookLogin(): void {
    console.log('� [LOGIN] Facebook login clicked');
    // TODO: Implement Facebook OAuth login
    this.toastService.show('Tính năng đăng nhập bằng Facebook đang được phát triển');
  }

  // Close popup when in popup mode
  onClosePopup(): void {
    if (this.isPopupMode) {
      this.authPopupService.closePopup();
    }
  }
}
