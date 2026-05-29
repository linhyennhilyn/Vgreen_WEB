import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

export interface UserInfo {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: string;
  avatar?: string;
}

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-personal-information',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personal-information.html',
  styleUrl: './personal-information.css',
})
export class PersonalInformation implements OnInit, OnDestroy {
  // User Information (displayed in avatar section)
  userInfo: UserInfo = {
    fullName: '',
    phone: '',
    email: '',
    password: '********',
    dateOfBirth: '',
    gender: 'male',
    avatar: '/asset/image/avt.png',
  };

  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  constructor(private authService: AuthService, private toastService: ToastService) {}

  // Temporary user info for form editing
  tempUserInfo: UserInfo = {
    fullName: '',
    phone: '',
    email: '',
    password: '',
    dateOfBirth: '',
    gender: 'male',
    avatar: '',
  };

  // Password Modal
  showPasswordModal = false;
  passwordData: PasswordData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  // UI States
  showPassword = false;
  maxDate: string = ''; // Max date for date of birth (18 years ago)
  actualPassword: string = '************'; // Default password length (12 characters) for display purposes only

  // Camera Modal States
  showCameraModal = false;
  capturedImage: string | null = null;
  mediaStream: MediaStream | null = null;

  ngOnInit() {
    // Set max date to 18 years ago
    this.setMaxDate();

    // QUAN TRỌNG: Force reload user từ localStorage vào AuthService
    // (vì login/register không qua AuthService nên currentUser$ chưa được emit)
    this.authService.reloadUserFromStorage();

    // Load user data from service or localStorage
    // (loadUserData sẽ tự động sync sang tempUserInfo)
    this.loadUserData();

    // Subscribe to auth service to get logged-in user info
    // (loadUserFromAuthService sẽ tự động sync sang tempUserInfo)
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        console.log(' [PersonalInfo] Đã nhận thông tin user từ AuthService:', user);
        this.loadUserFromAuthService(user);
      }
    });
  }

  // Set max date for date of birth (must be at least 18 years old)
  setMaxDate() {
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    this.maxDate = maxDate.toISOString().split('T')[0];
  }

  // Load user data from localStorage (data từ login)
  loadUserData() {
    console.log(' [PersonalInfo] Bắt đầu loadUserData()...');

    // Kiểm tra xem có thông tin user từ đăng nhập không
    const userStr = localStorage.getItem('user');
    console.log(' [PersonalInfo] localStorage["user"]:', userStr);

    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        console.log(' [PersonalInfo] Parsed user data:', userData);

        // Map dữ liệu từ user (login) sang userInfo
        // Backend trả về: Phone, CustomerID, RegisterDate
        this.userInfo.fullName = userData.fullName || userData.FullName || userData.name || '';
        this.userInfo.phone = userData.phoneNumber || userData.Phone || userData.phone || '';
        this.userInfo.email = userData.email || userData.Email || '';

        console.log(' [PersonalInfo] Mapped to userInfo:', {
          fullName: this.userInfo.fullName,
          phone: this.userInfo.phone,
          email: this.userInfo.email,
        });

        // Load thêm thông tin chi tiết từ userInfo nếu có (KHÔNG load avatar từ localStorage)
        const savedDetails = localStorage.getItem('userInfo');
        if (savedDetails) {
          const details = JSON.parse(savedDetails);
          this.userInfo.dateOfBirth = details.dateOfBirth || '';
          this.userInfo.gender = details.gender || 'male';
          // Avatar không được load từ localStorage, chỉ dùng default hoặc từ backend
          this.userInfo.avatar = '/asset/image/avt.png';
        } else {
          // Nếu không có savedDetails, đảm bảo avatar có giá trị mặc định
          this.userInfo.avatar = '/asset/image/avt.png';
        }

        // Load password length from localStorage if exists
        const savedPasswordLength = localStorage.getItem('userPasswordLength');
        if (savedPasswordLength) {
          const passwordLength = parseInt(savedPasswordLength, 10);
          this.actualPassword = '*'.repeat(passwordLength); // Use as display template
          console.log(' [PersonalInfo] Loaded passwordLength from localStorage:', passwordLength);
        }

        // Sync password display
        const passwordDisplay = '*'.repeat(this.actualPassword.length);
        this.userInfo.password = passwordDisplay;

        // QUAN TRỌNG: Copy sang tempUserInfo để hiển thị trong form
        this.tempUserInfo = { ...this.userInfo };
        console.log(' [PersonalInfo] Đã sync tempUserInfo:', this.tempUserInfo);
      } catch (error) {
        console.error(' [PersonalInfo] Lỗi parse user data:', error);
      }
    } else {
      console.log(' [PersonalInfo] Không tìm thấy localStorage["user"], thử fallback...');
      // Fallback: Load từ userInfo cũ nếu không có user từ login
      const savedData = localStorage.getItem('userInfo');
      if (savedData) {
        console.log(' [PersonalInfo] Fallback: Load từ userInfo');
        const parsedData = JSON.parse(savedData);
        // Avatar không được load từ localStorage, chỉ dùng default
        parsedData.avatar = '/asset/image/avt.png';
        this.userInfo = { ...this.userInfo, ...parsedData };

        // Load password length from localStorage if exists
        const savedPasswordLength = localStorage.getItem('userPasswordLength');
        if (savedPasswordLength) {
          const passwordLength = parseInt(savedPasswordLength, 10);
          this.actualPassword = '*'.repeat(passwordLength);
          console.log(
            ' [PersonalInfo] Loaded passwordLength from localStorage (fallback):',
            passwordLength
          );
        }

        // Sync password
        const passwordDisplay = '*'.repeat(this.actualPassword.length);
        this.userInfo.password = passwordDisplay;
        // Copy to tempUserInfo
        this.tempUserInfo = { ...this.userInfo };
      } else {
        console.log(' [PersonalInfo] Không có dữ liệu user nào trong localStorage!');
      }
    }
  }

  // Load user data từ AuthService (khi user vừa đăng nhập)
  loadUserFromAuthService(user: any) {
    console.log(' [PersonalInfo] Đang cập nhật từ AuthService với user:', user);

    // Backend trả về: Phone, CustomerID, RegisterDate
    this.userInfo.fullName = user.fullName || user.FullName || user.name || '';
    this.userInfo.phone = user.phoneNumber || user.Phone || user.phone || '';
    this.userInfo.email = user.email || user.Email || '';

    // Load thêm thông tin chi tiết từ userInfo nếu có (dateOfBirth, gender, v.v.)
    // KHÔNG load avatar từ localStorage, chỉ dùng default hoặc từ backend
    const savedDetails = localStorage.getItem('userInfo');
    if (savedDetails) {
      try {
        const details = JSON.parse(savedDetails);
        this.userInfo.dateOfBirth = details.dateOfBirth || '';
        this.userInfo.gender = details.gender || 'male';
        // Avatar không được load từ localStorage
        this.userInfo.avatar = '/asset/image/avt.png';
      } catch (error) {
        console.error(' [PersonalInfo] Lỗi parse userInfo details:', error);
        this.userInfo.avatar = '/asset/image/avt.png';
      }
    } else {
      // Nếu không có savedDetails, đảm bảo avatar có giá trị mặc định
      this.userInfo.avatar = '/asset/image/avt.png';
    }

    // Load password length from localStorage if exists
    const savedPasswordLength = localStorage.getItem('userPasswordLength');
    if (savedPasswordLength) {
      const passwordLength = parseInt(savedPasswordLength, 10);
      this.actualPassword = '*'.repeat(passwordLength);
      console.log(
        ' [PersonalInfo] Loaded passwordLength from localStorage (AuthService):',
        passwordLength
      );
    }

    // Sync password display
    const passwordDisplay = '*'.repeat(this.actualPassword.length);
    this.userInfo.password = passwordDisplay;

    // QUAN TRỌNG: Copy to tempUserInfo để hiển thị trong form
    this.tempUserInfo = { ...this.userInfo };

    console.log(' [PersonalInfo] Đã cập nhật userInfo và tempUserInfo từ AuthService');
    console.log(' tempUserInfo hiện tại:', this.tempUserInfo);
  }

  // Save user data
  saveUserData() {
    // Lưu thông tin chi tiết vào userInfo (KHÔNG lưu avatar vào localStorage)
    const userInfoToSave = { ...this.userInfo };
    // Xóa avatar khỏi object trước khi lưu vào localStorage
    delete userInfoToSave.avatar;
    localStorage.setItem('userInfo', JSON.stringify(userInfoToSave));

    // Đồng bộ với localStorage 'user' từ login
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        // Cập nhật các field trong user object (support both camelCase and PascalCase)
        // Always update, even if empty (to handle deletion)
        // Use explicit check to preserve empty strings
        userData.FullName = this.userInfo.fullName !== undefined ? this.userInfo.fullName : null;
        userData.fullName = this.userInfo.fullName !== undefined ? this.userInfo.fullName : null;

        if (this.userInfo.phone) {
          userData.Phone = this.userInfo.phone;
          userData.phoneNumber = this.userInfo.phone;
        }
        if (this.userInfo.email) {
          userData.Email = this.userInfo.email;
          userData.email = this.userInfo.email;
        }
        // Lưu lại vào localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        console.log(' [PersonalInfo] Đã đồng bộ user data vào localStorage');
      } catch (error) {
        console.error(' [PersonalInfo] Lỗi đồng bộ user data:', error);
      }
    }

    // Dispatch custom event to notify other components (like sidebar) in the same tab
    window.dispatchEvent(new CustomEvent('userInfoUpdated'));
  }

  // Form validation
  isFormValid(): boolean {
    return !!this.tempUserInfo.phone;
  }

  // Check if form has changes (exclude password field)
  hasChanges(): boolean {
    // Normalize empty values to compare properly
    const normalizeValue = (val: string | undefined) => val || '';

    const hasChange =
      normalizeValue(this.tempUserInfo.fullName) !== normalizeValue(this.userInfo.fullName) ||
      normalizeValue(this.tempUserInfo.dateOfBirth) !== normalizeValue(this.userInfo.dateOfBirth) ||
      normalizeValue(this.tempUserInfo.gender) !== normalizeValue(this.userInfo.gender) ||
      normalizeValue(this.tempUserInfo.phone) !== normalizeValue(this.userInfo.phone) ||
      normalizeValue(this.tempUserInfo.email) !== normalizeValue(this.userInfo.email);
    // Note: password is excluded from change detection

    return hasChange;
  }

  // Password form validation
  isPasswordFormValid(): boolean {
    return !!(
      this.passwordData.currentPassword &&
      this.passwordData.newPassword &&
      this.passwordData.confirmPassword &&
      this.passwordData.newPassword === this.passwordData.confirmPassword
    );
  }

  // Toggle password visibility
  togglePassword() {
    this.showPassword = !this.showPassword;
    // Update tempUserInfo.password based on showPassword state
    if (this.showPassword) {
      this.tempUserInfo.password = this.actualPassword;
    } else {
      this.tempUserInfo.password = '*'.repeat(this.actualPassword.length);
    }
  }

  // Clear input field and focus back
  clearField(fieldName: keyof UserInfo, inputElement: HTMLInputElement) {
    this.tempUserInfo[fieldName] = '' as any;
    // Focus back to the input after clearing
    setTimeout(() => {
      inputElement.focus();
    }, 0);
  }

  // Open date picker when clicking on date input
  openDatePicker(inputElement: HTMLInputElement) {
    try {
      inputElement.showPicker();
    } catch (error) {
      // Fallback for browsers that don't support showPicker()
      inputElement.focus();
    }
  }

  // Edit avatar - Open camera modal
  onEditAvatar() {
    this.showCameraModal = true;
    this.capturedImage = null;
    setTimeout(() => {
      this.startCamera();
    }, 300);
  }

  // Close camera modal
  closeCameraModal(): void {
    this.stopCamera();
    this.showCameraModal = false;
    this.capturedImage = null;
  }

  // Start camera
  async startCamera(): Promise<void> {
    try {
      if (!this.videoElement?.nativeElement) {
        setTimeout(() => this.startCamera(), 100);
        return;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      const video = this.videoElement.nativeElement;
      if (video && this.mediaStream) {
        video.srcObject = this.mediaStream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');

        video.onloadedmetadata = () => {
          video.play().catch((err) => {
            console.error('Error playing video:', err);
          });
        };

        video.play().catch((err) => {
          console.error('Error playing video immediately:', err);
        });
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  }

  // Stop camera
  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
  }

  // Capture photo
  capturePhoto(): void {
    if (this.videoElement?.nativeElement && this.canvasElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      const context = canvas.getContext('2d');

      if (video.videoWidth && video.videoHeight && context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        this.capturedImage = canvas.toDataURL('image/jpeg');
        this.stopCamera();
      }
    }
  }

  // Retake photo
  retakePhoto(): void {
    this.capturedImage = null;
    this.startCamera();
  }

  // Use photo as avatar
  usePhoto(): void {
    if (this.capturedImage) {
      this.tempUserInfo.avatar = this.capturedImage;
      this.userInfo.avatar = this.capturedImage;
      // KHÔNG lưu avatar vào localStorage, chỉ hiển thị trong session
      // TODO: Upload avatar lên backend khi có API

      // Dispatch custom event với avatar mới để sidebar cập nhật ngay
      window.dispatchEvent(
        new CustomEvent('avatarUpdated', {
          detail: { avatar: this.capturedImage },
        })
      );

      this.toastService.show('Ảnh đại diện đã được cập nhật!', 'success');
    }
    this.closeCameraModal();
  }

  // Handle file selection
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.capturedImage = e.target.result;
        this.stopCamera();
      };

      reader.readAsDataURL(file);
    }
  }

  // Change password
  onChangePassword() {
    this.showPasswordModal = true;
  }

  // Close password modal
  onClosePasswordModal() {
    this.showPasswordModal = false;
    this.passwordData = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
  }

  // Forgot password
  onForgotPassword(event: Event) {
    event.preventDefault();
    console.log('Forgot password clicked');
    alert('Chức năng quên mật khẩu sẽ được phát triển');
  }

  // Submit form
  onSubmit() {
    console.log(' [PersonalInfo] Submitting user info update...');

    // Get CustomerID from localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.toastService.show('Vui lòng đăng nhập lại!', 'error');
      return;
    }

    let customerID: string;
    try {
      const user = JSON.parse(userStr);
      customerID = user.CustomerID;
    } catch (error) {
      console.error(' [PersonalInfo] Error parsing user from localStorage:', error);
      this.toastService.show('Lỗi đọc thông tin người dùng!', 'error');
      return;
    }

    // Prepare update data
    // Always send fullName when form is submitted (even if empty, to handle deletion)
    const updateData: any = {
      customerID: customerID,
      // Send fullName: null if empty string (user deleted it), otherwise send the value
      fullName: this.tempUserInfo.fullName?.trim() || null,
    };

    if (this.tempUserInfo.email?.trim()) {
      updateData.email = this.tempUserInfo.email.trim();
    }
    if (this.tempUserInfo.dateOfBirth) {
      updateData.birthDay = this.tempUserInfo.dateOfBirth;
    }
    if (this.tempUserInfo.gender) {
      updateData.gender = this.tempUserInfo.gender;
    }
    // Note: Address will be updated from default address in address book

    console.log(' [PersonalInfo] Update data:', updateData);

    // Call API
    this.authService.updateUserInfo(updateData).subscribe({
      next: (response) => {
        if (response.success) {
          console.log(' [PersonalInfo] User info updated successfully:', response.data);

          // Copy tempUserInfo to userInfo (this updates the avatar section)
          this.userInfo = { ...this.tempUserInfo };
          this.saveUserData();

          this.toastService.show('Thông tin đã được cập nhật thành công!', 'success');
        } else {
          console.error(' [PersonalInfo] Update failed:', response.message);
          this.toastService.show(
            'Cập nhật thất bại: ' + (response.message || 'Unknown error'),
            'error'
          );
        }
      },
      error: (error) => {
        console.error(' [PersonalInfo] Error updating user info:', error);
        const errorMessage = error.error?.message || error.message || 'Unknown error';
        this.toastService.show('Lỗi cập nhật thông tin: ' + errorMessage, 'error');
      },
    });
  }

  // Submit password change
  onSubmitPasswordChange() {
    // Validate password match
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.toastService.show('Mật khẩu xác nhận không khớp!', 'error');
      return;
    }

    // Validate password requirements với thứ tự ưu tiên:
    // 1. Kiểm tra độ dài trước (ưu tiên thông báo chưa đủ 8 ký tự)
    // 2. Sau đó mới kiểm tra chữ hoa (nếu đủ 8 ký tự nhưng thiếu chữ hoa)
    if (this.passwordData.newPassword.length < 8) {
      this.toastService.show('Mật khẩu phải có ít nhất 8 ký tự!', 'error');
      return;
    }

    // Nếu đủ 8 ký tự nhưng chưa có chữ hoa
    if (!/^(?=.*[A-Z])/.test(this.passwordData.newPassword)) {
      this.toastService.show('Mật khẩu phải có ít nhất 1 chữ cái in hoa!', 'error');
      return;
    }

    // Get CustomerID from localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.toastService.show('Vui lòng đăng nhập lại!', 'error');
      this.onClosePasswordModal();
      return;
    }

    let customerID: string;
    try {
      const user = JSON.parse(userStr);
      customerID = user.CustomerID;
    } catch (error) {
      console.error(' [PersonalInfo] Error parsing user from localStorage:', error);
      this.toastService.show('Lỗi đọc thông tin người dùng!', 'error');
      this.onClosePasswordModal();
      return;
    }

    if (!customerID) {
      this.toastService.show('Không tìm thấy thông tin người dùng!', 'error');
      this.onClosePasswordModal();
      return;
    }

    console.log(' [PersonalInfo] Changing password for customer:', customerID);

    // Call API to change password
    this.authService
      .changePassword({
        customerID: customerID,
        currentPassword: this.passwordData.currentPassword,
        newPassword: this.passwordData.newPassword,
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            console.log(' [PersonalInfo] Password changed successfully');

            // Save password length to localStorage (not the actual password for security)
            localStorage.setItem(
              'userPasswordLength',
              this.passwordData.newPassword.length.toString()
            );

            // Update actualPassword for display purposes (use as template)
            this.actualPassword = '*'.repeat(this.passwordData.newPassword.length);

            // Update password display (show asterisks based on new password length)
            const passwordDisplay = '*'.repeat(this.passwordData.newPassword.length);
            this.userInfo.password = passwordDisplay;

            // Reset showPassword to false and update display
            this.showPassword = false;
            this.tempUserInfo.password = passwordDisplay;

            // Save updated password length to localStorage
            this.saveUserData();

            this.toastService.show('Mật khẩu đã được thay đổi thành công!', 'success');
            this.onClosePasswordModal();
          } else {
            console.error(' [PersonalInfo] Password change failed:', response.error);
            this.toastService.show(response.error || 'Đổi mật khẩu thất bại!', 'error');
          }
        },
        error: (error) => {
          console.error(' [PersonalInfo] Error changing password:', error);
          const errorMessage =
            error.error?.error || error.error?.message || 'Lỗi khi đổi mật khẩu!';
          this.toastService.show(errorMessage, 'error');
        },
      });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
