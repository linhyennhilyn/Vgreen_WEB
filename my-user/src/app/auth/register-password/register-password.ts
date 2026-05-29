import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-password',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register-password.html',
  styleUrls: ['./register-password.css'],
})
export class RegisterPassword implements OnInit {
  @Input() phoneNumber: string = '';
  @Input() isPopupMode: boolean = false;
  @Output() navigateToLogin = new EventEmitter<void>();
  @Output() registerSuccess = new EventEmitter<void>();

  password: string = '';
  confirmPassword: string = '';

  passwordError: string = '';
  confirmError: string = '';

  showPassword: boolean = false;
  showConfirm: boolean = false;

  showSuccessMessage: boolean = false;
  isNavigating: boolean = false; // Flag để tránh redirect khi đang navigation
  registrationSuccessful: boolean = false; // Flag để ngăn ngOnInit chạy lại

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
 console.log(' [REGISTER-PASSWORD] ngOnInit called');
 console.log(' [REGISTER-PASSWORD] registrationSuccessful flag:', this.registrationSuccessful);

 // QUAN TRỌNG: Nếu đăng ký đã thành công, KHÔNG làm gì cả
    if (this.registrationSuccessful) {
 console.log(
        ' [REGISTER-PASSWORD] Đăng ký thành công, đang chờ chuyển trang, bỏ qua ngOnInit'
      );
      return;
    }

 // Get phone number from session storage
    this.phoneNumber = sessionStorage.getItem('registerPhone') || '';
    const otpVerified = sessionStorage.getItem('registerOtpVerified');
    const isRegistrationCompleted = sessionStorage.getItem('registrationCompleted');

 console.log(' [REGISTER-PASSWORD] Phone:', this.phoneNumber);
 console.log(' [REGISTER-PASSWORD] OTP Verified:', otpVerified);
 console.log(' [REGISTER-PASSWORD] Registration Completed:', isRegistrationCompleted);
 console.log(' [REGISTER-PASSWORD] isPopupMode:', this.isPopupMode);

 // Nếu đã hoàn thành đăng ký, redirect về login
    if (isRegistrationCompleted === 'true') {
 console.log(' [REGISTER-PASSWORD] Đăng ký đã hoàn thành, redirecting to login');
 // Clear flag để tránh redirect loop
      sessionStorage.removeItem('registrationCompleted');
      this.router.navigate(['/login']);
      return;
    }

 // Kiểm tra điều kiện truy cập trang (chỉ cho standalone mode)
    if (!this.isPopupMode && (!this.phoneNumber || !otpVerified)) {
 console.log(
        ' [REGISTER-PASSWORD] Missing phone or OTP verification, redirecting to register'
      );
      this.router.navigate(['/register']);
      return;
    }

 console.log(' [REGISTER-PASSWORD] ngOnInit completed, ready for password input');
  }

  onPasswordInput(event: any): void {
    this.password = event.target.value;
    this.validatePassword();
    this.validateConfirm();
  }

  onConfirmInput(event: any): void {
    this.confirmPassword = event.target.value;
    this.validateConfirm();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirm(): void {
    this.showConfirm = !this.showConfirm;
  }

  validatePassword(): void {
    if (!this.password) {
      this.passwordError = '';
      return;
    }
    if (this.password.length < 8) {
      this.passwordError = 'Mật khẩu phải có ít nhất 8 ký tự.';
      return;
    }
    if (!/(?=.*[A-Z])/.test(this.password)) {
      this.passwordError = 'Mật khẩu phải có ít nhất 1 chữ cái in hoa.';
      return;
    }
    this.passwordError = '';
  }

  validateConfirm(): void {
    if (!this.confirmPassword) {
      this.confirmError = '';
      return;
    }
    this.confirmError =
      this.confirmPassword === this.password ? '' : 'Mật khẩu nhập lại không khớp.';
  }

  isFormValid(): boolean {
    return (
      this.password.length >= 8 &&
      this.confirmPassword === this.password &&
      !this.passwordError &&
      !this.confirmError
    );
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    const registerData = {
      phoneNumber: this.phoneNumber,
      password: this.password,
      fullName: '',
      email: '',
    };

    console.log(' [REGISTER-PASSWORD] Gửi request đăng ký Supabase...');

    this.authService.register(registerData).subscribe({
      next: (response) => {
        if (!response.success) {
          console.error(' [REGISTER-PASSWORD] Đăng ký Supabase thất bại:', response.message);
          return;
        }

        console.log(' [REGISTER-PASSWORD] Đăng ký thành công qua Supabase!', response);
        this.registrationSuccessful = true;
        this.showSuccessMessage = true;

        sessionStorage.removeItem('registerPhone');
        sessionStorage.removeItem('registerOtpVerified');
        sessionStorage.removeItem('registerOtp');
        sessionStorage.removeItem('registrationCompleted');
        sessionStorage.removeItem('activePopup');
        sessionStorage.removeItem('popupData');

        setTimeout(() => {
          if (this.isPopupMode) {
            this.registerSuccess.emit();
          } else {
            window.location.href = '/';
          }
        }, 2000);
      },
      error: (error) => {
        console.error(' [REGISTER-PASSWORD] Lỗi đăng ký Supabase:', error);
      },
    });
  }

 // Popup navigation methods
  onLoginClick(event: Event) {
    event.preventDefault();
    this.navigateToLogin.emit();
  }
}
