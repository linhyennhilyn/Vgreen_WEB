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
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthPopupService } from '../../services/auth-popup.service';

@Component({
  selector: 'app-register-phone',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './register-phone.html',
  styleUrls: ['./register-phone.css'],
})
export class RegisterPhone implements OnInit {
  @Input() isPopupMode: boolean = false;
  @Output() navigateToLogin = new EventEmitter<void>();
  @Output() navigateToOTP = new EventEmitter<string>();

  @ViewChild('phoneInput') phoneInputRef!: ElementRef<HTMLInputElement>;

  phoneNumber: string = '';
  phoneError: string = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private authPopupService: AuthPopupService
  ) {}

  ngOnInit(): void {
    // Clear forgot password flow data khi bắt đầu registration flow
    sessionStorage.removeItem('forgotPasswordPhone');
    sessionStorage.removeItem('forgotPasswordOtpVerified');
    sessionStorage.removeItem('forgotPasswordOtp');
    sessionStorage.removeItem('passwordResetCompleted');

    // Auto-focus vào input số điện thoại khi vào trang
    setTimeout(() => {
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.focus();
      }
    }, 100);
  }

  onPhoneInput(event: any): void {
    this.phoneNumber = event.target.value;
    this.validatePhone();
  }

  validatePhone(): void {
    this.phoneError = this.isPhoneValid()
      ? ''
      : this.phoneNumber
      ? 'Số điện thoại không hợp lệ.'
      : '';
  }

  isPhoneValid(): boolean {
    return /^[0-9]{10,11}$/.test(this.phoneNumber);
  }

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

  onSubmit(): void {
    if (!this.isPhoneValid()) return;

    this.phoneError = '';

    // Kiểm tra số điện thoại đã tồn tại chưa
    this.http.post('/api/auth/check-phone', { phoneNumber: this.phoneNumber }).subscribe({
      next: (response: any) => {
        console.log('Số điện thoại có thể sử dụng:', response);

        // Xóa sessionStorage của forgot password flow nếu có
        sessionStorage.removeItem('forgotPasswordPhone');
        sessionStorage.removeItem('forgotPasswordOtpVerified');
        sessionStorage.removeItem('forgotPasswordOtp');

        // Store phone number in session storage for next steps
        sessionStorage.setItem('registerPhone', this.phoneNumber);

        // Navigate based on mode
        if (this.isPopupMode) {
          this.navigateToOTP.emit(this.phoneNumber);
        } else {
          this.router.navigate(['/register/otp']);
        }
      },
      error: (error) => {
        console.error(' Lỗi kiểm tra số điện thoại:', error);
        if (error.status === 400) {
          this.phoneError = 'Số điện thoại đã được đăng ký';
        } else {
          this.phoneError = 'Lỗi kết nối, vui lòng thử lại';
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
