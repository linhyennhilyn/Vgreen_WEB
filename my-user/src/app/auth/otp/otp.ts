import {
  Component,
  OnInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './otp.html',
  styleUrls: ['./otp.css'],
})
export class OtpComponent implements OnInit, OnDestroy {
  @Input() phoneNumber: string = '';
  @Input() isPopupMode: boolean = false;
  @Input() flowType: 'register' | 'forgot' = 'register';
  @Output() navigateBack = new EventEmitter<void>();
  @Output() navigateToNext = new EventEmitter<string>();

  otpDigits: string[] = ['', '', '', '', '', ''];
  otpError: string = '';
  countdown: number = 30;
  isLoading: boolean = false;
  currentOtp: string = '';
  private countdownInterval: any;
  private isVerifying: boolean = false;
  private lastInputValue: string[] = ['', '', '', '', '', '']; // Track giá trị trước đó

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private readonly OTP_LENGTH = 6;
  private readonly COUNTDOWN_DURATION = 30;
  private readonly SUCCESS_DELAY = 800;
  private readonly ERROR_DELAY = 800;

  constructor(
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  private generateRandomOtp(): string {
    const min = 400000;
    const max = 600000;
    let otp = Math.floor(min + Math.random() * (max - min + 1));

    if (otp % 2 !== 0) {
      otp = otp - 1;
    }

    return otp.toString();
  }

  goBack(): void {
    if (this.isPopupMode) {
      this.navigateBack.emit();
    } else {
      if (this.flowType === 'register') {
        this.router.navigate(['/register']);
      } else {
        this.router.navigate(['/forgot-password']);
      }
    }
  }

  ngOnInit(): void {
 console.log('=== OTP Component initialized ===');
 console.log('Current path:', window.location.pathname);

    if (this.isPopupMode) {
 // Trong popup mode, sử dụng flowType từ @Input
 console.log(' Popup mode - Flow type:', this.flowType);
    } else {
 // Ưu tiên URL path để xác định flow type
      if (window.location.pathname.includes('forgot-password')) {
        this.flowType = 'forgot';
        this.phoneNumber = sessionStorage.getItem('forgotPasswordPhone') || 'Unknown';
 // console.log(' Detected FORGOT flow from URL');
      } else {
        this.flowType = 'register';
        this.phoneNumber = sessionStorage.getItem('registerPhone') || 'Unknown';
 // console.log(' Detected REGISTER flow from URL');
      }
    }

 // console.log(' Flow type:', this.flowType);
 console.log('Phone:', this.phoneNumber);

    this.currentOtp = this.generateRandomOtp();
 console.log('OTP LÀ:', this.currentOtp);

 // Hiển thị OTP trong toast 5 giây khi mới vào trang (z-index cao nhất)
    this.toastService.show(`Mã OTP của bạn: ${this.currentOtp}`, 'success', 99999, 10000);

    this.startCountdown();
    setTimeout(() => this.focusInput(0), 100);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  startCountdown(): void {
    this.countdown = this.COUNTDOWN_DURATION;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  resendOtp(): void {
    if (this.countdown > 0 || this.isLoading) return;

    this.isLoading = true;
    this.otpError = '';

 // Generate OTP mới
    this.currentOtp = this.generateRandomOtp();
 console.log('>>> NEW OTP:', this.currentOtp);

 // Hiển thị OTP trong toast 5 giây khi gửi lại (z-index cao nhất)
    this.toastService.show(`Mã OTP mới: ${this.currentOtp}`, 'success', 99999, 10000);

 // Clear inputs và reset
    this.clearOtpInputs();

    if (this.flowType === 'register') {
      this.resendRegistrationOtp();
    } else {
      this.resendForgotPasswordOtp();
    }
  }

  private resendRegistrationOtp(): void {
    const phoneNumber = sessionStorage.getItem('registerPhone');
    if (!phoneNumber) {
      this.otpError = 'Không tìm thấy số điện thoại đăng ký';
      this.isLoading = false;
      return;
    }

    this.authService.sendOtp(phoneNumber).subscribe({
      next: (response: any) => {
 console.log('(v) Resend OTP thành công:', response);
        this.startCountdown();
        this.isLoading = false;
      },
      error: (error: any) => {
 console.error('(x) Lỗi resend OTP:', error);
        this.otpError = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
        this.isLoading = false;
      },
    });
  }

  private resendForgotPasswordOtp(): void {
    const phoneNumber = sessionStorage.getItem('forgotPasswordPhone');
    if (!phoneNumber) {
      this.otpError = 'Không tìm thấy số điện thoại';
      this.isLoading = false;
      return;
    }

    this.authService.sendForgotPasswordOtp(phoneNumber).subscribe({
      next: (response: any) => {
 console.log('(v) Resend forgot password OTP thành công:', response);
        this.startCountdown();
        this.isLoading = false;
      },
      error: (error: any) => {
 console.error('(x) Lỗi resend forgot password OTP:', error);
        this.otpError = 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
        this.isLoading = false;
      },
    });
  }

 // XỬ LÝ INPUT EVENT
  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

 // console.log(
 // ' [INPUT] Ô',
 // index,
 // '| Value:',
 // `"${value}"`,
 // '| Last:',
 // this.lastInputValue[index]
 // );

 // Kiểm tra OTP hết hạn
    if (this.isOtpExpired()) {
      input.value = '';
      this.otpDigits[index] = '';
      this.lastInputValue[index] = '';
      this.otpError = 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.';
      this.showErrorState();
      setTimeout(() => {
        this.hideErrorState();
        this.clearOtpInputs();
      }, 1000);
      return;
    }

 // Lọc chỉ lấy số
    const numericValue = value.replace(/\D/g, '');

 // Trường hợp rỗng
    if (!numericValue) {
      this.otpDigits[index] = '';
      this.lastInputValue[index] = '';
      input.value = '';
      return;
    }

 // Tìm ký tự mới được thêm vào
    let newDigit = '';

    if (numericValue.length === 1) {
      newDigit = numericValue;
    } else {
 // Nếu có nhiều ký tự, tìm ký tự khác với last value
      for (let i = 0; i < numericValue.length; i++) {
        if (numericValue[i] !== this.lastInputValue[index]) {
          newDigit = numericValue[i];
          break;
        }
      }
 // Nếu không tìm thấy, lấy ký tự cuối
      if (!newDigit) {
        newDigit = numericValue[numericValue.length - 1];
      }
    }

 // console.log('� [INPUT] New digit:', newDigit);

 // Cập nhật giá trị
    this.otpDigits[index] = newDigit;
    this.lastInputValue[index] = newDigit;
    input.value = newDigit;

 // Clear error
    this.otpError = '';

 // console.log(' [INPUT] Updated ô', index, '=', newDigit);
 // console.log(' [INPUT] OTP:', this.otpDigits.join(''));

 // Focus ô tiếp theo
    if (index < this.OTP_LENGTH - 1) {
      setTimeout(() => this.focusInput(index + 1), 10);
    }

 // Auto-verify khi đủ 6 số
    if (this.otpDigits.every((d) => d !== '')) {
 console.log('Đủ 6 số Verify');
      setTimeout(() => this.verifyOtp(), 100);
    }
  }

 // XỬ LÝ KEYDOWN
  onKeyDown(event: KeyboardEvent, index: number): void {
    const key = event.key;

 // console.log(' [KEYDOWN] Key:', key, '| Ô:', index);

 // Backspace
    if (key === 'Backspace') {
      event.preventDefault();

 // Xóa ô hiện tại
      this.otpDigits[index] = '';
      this.lastInputValue[index] = '';
      const input = event.target as HTMLInputElement;
      input.value = '';

 // console.log(' [KEYDOWN] Xóa ô', index);

 // Kiểm tra xem tất cả các ô đã trống chưa
      const allEmpty = this.otpDigits.every((digit) => digit === '');

      if (allEmpty) {
 // Nếu tất cả đã trống, focus về ô đầu tiên
 // console.log(' [KEYDOWN] Tất cả ô đã trống Focus ô đầu');
        setTimeout(() => this.focusInput(0), 10);
      } else if (index > 0) {
 // Nếu chưa trống hết, quay lại ô trước
        setTimeout(() => this.focusInput(index - 1), 10);
      } else {
 // Nếu đã ở ô đầu, focus lại ô đầu
        setTimeout(() => this.focusInput(0), 10);
      }
      return;
    }

 // Delete
    if (key === 'Delete') {
      event.preventDefault();
      this.otpDigits[index] = '';
      this.lastInputValue[index] = '';
      const input = event.target as HTMLInputElement;
      input.value = '';
 // console.log(' [KEYDOWN] Delete ô', index);
      return;
    }

 // Arrow keys
    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusInput(index - 1);
      return;
    }

    if (key === 'ArrowRight' && index < this.OTP_LENGTH - 1) {
      event.preventDefault();
      this.focusInput(index + 1);
      return;
    }

 // Enter
    if (key === 'Enter') {
      event.preventDefault();
      this.verifyOtp();
      return;
    }

 // Tab
    if (key === 'Tab') {
      return;
    }

 // Chặn ký tự không phải số
    if (!/^\d$/.test(key) && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();

 // console.log(' [PASTE] Detected');

    if (this.isOtpExpired()) {
      this.otpError = 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.';
      this.showErrorState();
      setTimeout(() => {
        this.hideErrorState();
        this.clearOtpInputs();
      }, 1000);
      return;
    }

    const pastedData = event.clipboardData?.getData('text') || '';
    const numbers = pastedData.replace(/\D/g, '');

 // console.log(' [PASTE] Numbers:', numbers);

    if (numbers.length > 0) {
      for (let i = 0; i < Math.min(numbers.length, this.OTP_LENGTH); i++) {
        this.otpDigits[i] = numbers[i];
        this.lastInputValue[i] = numbers[i];
        const inputElement = this.otpInputs.toArray()[i];
        if (inputElement?.nativeElement) {
          inputElement.nativeElement.value = numbers[i];
        }
      }

      this.otpError = '';

      const focusIndex = Math.min(numbers.length, this.OTP_LENGTH - 1);
      this.focusInput(focusIndex);

      if (numbers.length >= this.OTP_LENGTH) {
 // console.log(' [PASTE] Đủ 6 số Verify');
        setTimeout(() => this.verifyOtp(), 100);
      }
    }
  }

  onSubmit(): void {
    this.verifyOtp();
  }

  private focusInput(index: number): void {
    setTimeout(() => {
      if (this.otpInputs && this.otpInputs.length > index) {
        const input = this.otpInputs.toArray()[index];
        if (input?.nativeElement) {
          input.nativeElement.focus();
          input.nativeElement.select();
        }
      }
    }, 0);
  }

  verifyOtp(): void {
    if (this.isVerifying) {
 console.log('Already verifying, skip');
      return;
    }

    const otpCode = this.otpDigits.join('');

 console.log('>>> [VERIFY] OTP vừa nhập:', otpCode);
 console.log('>>> [VERIFY] OTP từ server:', this.currentOtp);

    if (otpCode.length !== this.OTP_LENGTH) {
      this.otpError = 'Vui lòng nhập đầy đủ 6 số OTP';
      return;
    }

    this.isVerifying = true;
    this.otpError = '';

 // KIỂM TRA OTP CỤC BỘ (cho testing)
    if (otpCode === this.currentOtp) {
 // console.log(' [VERIFY] Local OTP match!');

 // Show success
      this.showSuccessState();

 // Set session storage
      if (this.flowType === 'register') {
        sessionStorage.setItem('registerOtpVerified', 'true');
        sessionStorage.setItem('registerOtp', otpCode);

        setTimeout(() => {
          if (this.isPopupMode) {
            this.navigateToNext.emit(this.phoneNumber);
          } else {
            this.router.navigate(['/register/password']);
          }
        }, this.SUCCESS_DELAY);
      } else {
        sessionStorage.setItem('forgotPasswordOtpVerified', 'true');
        sessionStorage.setItem('forgotPasswordOtp', otpCode);

        setTimeout(() => {
          if (this.isPopupMode) {
            this.navigateToNext.emit(this.phoneNumber);
          } else {
            this.router.navigate(['/forgot-password/reset']);
          }
        }, this.SUCCESS_DELAY);
      }

      return;
    }

 // Nếu không match local, gọi API
 // console.log(' [VERIFY] Local mismatch, calling API...');

    if (this.flowType === 'register') {
      this.verifyRegistrationOtp(otpCode);
    } else if (this.flowType === 'forgot') {
      this.verifyForgotPasswordOtp(otpCode);
    }
  }

  private verifyRegistrationOtp(otpCode: string): void {
 // console.log(' Verifying registration OTP via API...');

    this.authService.verifyOtp(this.phoneNumber, otpCode).subscribe({
      next: (response: any) => {
 console.log('>>> Registration OTP verified successfully:', response);

        this.showSuccessState();

        sessionStorage.setItem('registerOtpVerified', 'true');
        sessionStorage.setItem('registerOtp', otpCode);

        setTimeout(() => {
          if (this.isPopupMode) {
            this.navigateToNext.emit(this.phoneNumber);
          } else {
            this.router.navigate(['/register/password']);
          }
        }, this.SUCCESS_DELAY);
      },
      error: (error: any) => {
 console.error('Registration OTP verification failed:', error);
        this.handleOtpError(error);
      },
    });
  }

  private verifyForgotPasswordOtp(otpCode: string): void {
 // console.log(' Verifying forgot password OTP via API...');

    this.authService.verifyForgotPasswordOtp(this.phoneNumber, otpCode).subscribe({
      next: (response: any) => {
 console.log('>>> Forgot password OTP verified successfully:', response);

        this.showSuccessState();

        sessionStorage.setItem('forgotPasswordOtpVerified', 'true');
        sessionStorage.setItem('forgotPasswordOtp', otpCode);

        setTimeout(() => {
          if (this.isPopupMode) {
            this.navigateToNext.emit(this.phoneNumber);
          } else {
            this.router.navigate(['/forgot-password/reset']);
          }
        }, this.SUCCESS_DELAY);
      },
      error: (error: any) => {
 console.error('Forgot password OTP verification failed:', error);
        this.handleOtpError(error);
      },
    });
  }

  private handleOtpError(error: any): void {
    this.isVerifying = false;

    if (error.status === 400) {
      this.otpError = 'Mã OTP không chính xác. Vui lòng kiểm tra lại.';
    } else if (error.status === 404) {
      this.otpError = 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.';
    } else {
      this.otpError = 'Có lỗi xảy ra. Vui lòng thử lại.';
    }

    this.showErrorState();

    setTimeout(() => {
      this.hideErrorState();
      this.clearOtpInputs();
    }, 1000);
  }

  canResendOtp(): boolean {
    return this.countdown <= 0 && !this.isLoading;
  }

  getDisplayPhoneNumber(): string {
    if (this.phoneNumber === 'Unknown') {
      return 'số điện thoại của bạn';
    }
    return this.phoneNumber;
  }

  getTitle(): string {
    return this.flowType === 'register' ? 'Xác thực đăng ký' : 'Xác thực quên mật khẩu';
  }

  getDescription(): string {
    return this.flowType === 'register'
      ? 'Nhập mã OTP đã gửi đến số điện thoại của bạn để hoàn tất đăng ký'
      : 'Nhập mã OTP đã gửi đến số điện thoại của bạn để đặt lại mật khẩu';
  }

  showErrorState(): void {
 // console.log('� Showing error state');
    setTimeout(() => {
      const otpInputs = document.querySelectorAll('.otp-digit');
      otpInputs.forEach((input) => {
        input.classList.add('error-state');
        (input as HTMLElement).style.borderColor = '#e53935';
        (input as HTMLElement).style.backgroundColor = '#ffebee';
        (input as HTMLElement).style.boxShadow = '0 0 0 3px rgba(229, 57, 53, 0.2)';
      });
    }, 10);
  }

  showSuccessState(): void {
 // console.log(' Showing success state');
    setTimeout(() => {
      const otpInputs = document.querySelectorAll('.otp-digit');
      otpInputs.forEach((input) => {
        input.classList.add('success-state');
        (input as HTMLElement).style.borderColor = '#28a745';
        (input as HTMLElement).style.backgroundColor = '#d4edda';
        (input as HTMLElement).style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2)';
      });
    }, 10);
  }

  hideErrorState(): void {
 // console.log(' Hiding error state');
    const otpInputs = document.querySelectorAll('.otp-digit');
    otpInputs.forEach((input) => {
      input.classList.remove('error-state');
      (input as HTMLElement).style.borderColor = '';
      (input as HTMLElement).style.backgroundColor = '';
      (input as HTMLElement).style.boxShadow = '';
    });
  }

  hideSuccessState(): void {
 // console.log(' Hiding success state');
    const otpInputs = document.querySelectorAll('.otp-digit');
    otpInputs.forEach((input) => {
      input.classList.remove('success-state');
      (input as HTMLElement).style.borderColor = '';
      (input as HTMLElement).style.backgroundColor = '';
      (input as HTMLElement).style.boxShadow = '';
    });
  }

  private clearOtpInputs(): void {
 // console.log(' Clearing all OTP inputs');
    this.otpDigits = ['', '', '', '', '', ''];
    this.lastInputValue = ['', '', '', '', '', ''];
    this.isVerifying = false;

    if (this.otpInputs) {
      this.otpInputs.forEach((input) => {
        if (input.nativeElement) {
          input.nativeElement.value = '';
        }
      });
    }

    setTimeout(() => this.focusInput(0), 100);
  }

  private isOtpExpired(): boolean {
    return this.countdown <= 0;
  }
}
