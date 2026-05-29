import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthPopupService } from '../../services/auth-popup.service';

@Component({
  selector: 'app-forgot-password-phone',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './forgot-password-phone.html',
  styleUrls: ['./forgot-password-phone.css'],
})
export class ForgotPasswordPhone implements OnInit {
  @Input() isPopupMode: boolean = false;
  @Output() navigateToLogin = new EventEmitter<void>();
  @Output() navigateToOTP = new EventEmitter<string>();

  phoneNumber: string = '';
  phoneError: string = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private authPopupService: AuthPopupService
  ) {}

  ngOnInit(): void {
    // Clear registration flow data khi bắt đầu forgot password flow
    sessionStorage.removeItem('registerPhone');
    sessionStorage.removeItem('registerOtpVerified');
    sessionStorage.removeItem('registerOtp');
    sessionStorage.removeItem('registrationCompleted');

    // Auto-focus vào input số điện thoại khi vào trang
    setTimeout(() => {
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();
      }
    }, 100);
  }

  onPhoneInput(event: any): void {
    const value = event.target.value;
    this.phoneNumber = value;
    this.phoneError = '';
    this.validatePhone();
  }

  validatePhone(): void {
    const phoneRegex = /^[0-9]{10,11}$/;
    if (this.phoneNumber && !phoneRegex.test(this.phoneNumber)) {
      this.phoneError = 'Số điện thoại không hợp lệ.';
    } else {
      this.phoneError = '';
    }
  }

  isPhoneValid(): boolean {
    const phoneRegex = /^[0-9]{10,11}$/;
    return phoneRegex.test(this.phoneNumber);
  }

  clearPhone(): void {
    this.phoneNumber = '';
    this.phoneError = '';

    // Focus vào ô input sau khi clear
    setTimeout(() => {
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();
      }
    }, 10);
  }

  onSubmit(): void {
    if (!this.isPhoneValid()) {
      this.phoneError = 'Số điện thoại không hợp lệ.';
      return;
    }

    this.phoneError = ''; // Clear previous error

    // Kiểm tra số điện thoại có tồn tại trong database không
    this.http.post('/api/auth/check-phone-exists', { phoneNumber: this.phoneNumber }).subscribe({
      next: (response: any) => {
        console.log('(x) Số điện thoại tồn tại:', response);

        // Xóa sessionStorage của registration flow nếu có
        sessionStorage.removeItem('registerPhone');
        sessionStorage.removeItem('registerOtpVerified');
        sessionStorage.removeItem('registerOtp');

        // Store phone number in session storage for forgot password flow
        sessionStorage.setItem('forgotPasswordPhone', this.phoneNumber);

        // Navigate based on mode
        if (this.isPopupMode) {
          this.navigateToOTP.emit(this.phoneNumber);
        } else {
          this.router.navigate(['/forgot-password/otp']);
        }
      },
      error: (error) => {
        console.error(' Lỗi kiểm tra số điện thoại:', error);
        console.error(' Chi tiết lỗi:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
        });

        // Lấy error message từ backend nếu có
        const errorMessage = error.error?.error || error.error?.message;

        // Xử lý các loại lỗi khác nhau
        if (error.status === 0 || !error.status) {
          // Network error - không kết nối được đến backend hoặc status undefined
          this.phoneError = 'Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.';
        } else if (error.status === 400 || errorMessage?.includes('chưa được đăng ký')) {
          // Số điện thoại chưa được đăng ký hoặc dữ liệu không hợp lệ
          this.phoneError = errorMessage || 'Số điện thoại chưa được đăng ký';
        } else if (error.status === 404) {
          this.phoneError = 'Số điện thoại chưa được đăng ký';
        } else {
          this.phoneError = errorMessage || 'Lỗi kết nối, vui lòng thử lại';
        }
      },
    });
  }

  // Popup navigation methods
  onLoginClick(event: Event) {
    event.preventDefault();
    this.navigateToLogin.emit();
  }

  // Close popup when in popup mode
  onClosePopup(): void {
    if (this.isPopupMode) {
      this.authPopupService.closePopup();
    }
  }
}
