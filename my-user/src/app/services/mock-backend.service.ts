import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface User {
  id: string;
  phoneNumber: string;
  fullName: string;
  email?: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface OTPRecord {
  id: string;
  phoneNumber: string;
  otp: string;
  createdAt: string;
  isUsed: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: Omit<User, 'passwordHash'>;
    token: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MockBackendService {
  private readonly USERS_KEY = 'vgreen_users';
  private readonly OTP_KEY = 'vgreen_otp';

  constructor() {
    this.initializeStorage();
  }

 // Generate OTP với điều kiện: 400000-600000 và số cuối chẵn
  private generateValidOtp(): string {
 // Tạo số trong khoảng 400000-600000
    const min = 400000;
    const max = 600000;
    let otp = Math.floor(min + Math.random() * (max - min + 1));

 // Đảm bảo số cuối cùng là số chẵn
    if (otp % 2 !== 0) {
      otp = otp - 1; // Giảm 1 để thành số chẵn
    }

    return otp.toString();
  }

 // Khởi tạo storage nếu chưa có
  private initializeStorage(): void {
    if (!localStorage.getItem(this.USERS_KEY)) {
      localStorage.setItem(this.USERS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.OTP_KEY)) {
      localStorage.setItem(this.OTP_KEY, JSON.stringify([]));
    }
  }

 // Lấy danh sách users
  private getUsers(): User[] {
    const usersStr = localStorage.getItem(this.USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  }

 // Lưu users
  private saveUsers(users: User[]): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

 // Lấy danh sách OTP
  private getOTPs(): OTPRecord[] {
    const otpStr = localStorage.getItem(this.OTP_KEY);
    return otpStr ? JSON.parse(otpStr) : [];
  }

 // Lưu OTP
  private saveOTPs(otps: OTPRecord[]): void {
    localStorage.setItem(this.OTP_KEY, JSON.stringify(otps));
  }

 // Tạo ID ngẫu nhiên
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

 // Hash password đơn giản (trong thực tế nên dùng bcrypt)
  private hashPassword(password: string): string {
    return btoa(password + '_hashed'); // Base64 encoding
  }

 // So sánh password
  private comparePassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

 // Tạo JWT token đơn giản
  private generateToken(userId: string, phoneNumber: string): string {
    const payload = {
      userId,
      phoneNumber,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    return btoa(JSON.stringify(payload));
  }

 // Đăng ký user
  register(userData: {
    phoneNumber: string;
    password: string;
    fullName: string;
    email?: string;
  }): Observable<AuthResponse> {
    return new Observable((observer) => {
      setTimeout(() => {
        try {
          const users = this.getUsers();

 // Kiểm tra số điện thoại đã tồn tại chưa
          const existingUser = users.find((u) => u.phoneNumber === userData.phoneNumber);
          if (existingUser) {
            observer.next({
              success: false,
              message: 'Số điện thoại đã được đăng ký',
            });
            observer.complete();
            return;
          }

 // Tạo user mới
          const newUser: User = {
            id: this.generateId(),
            phoneNumber: userData.phoneNumber,
            fullName: userData.fullName,
            email: userData.email || undefined,
            passwordHash: this.hashPassword(userData.password),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

 // Lưu user
          users.push(newUser);
          this.saveUsers(users);

 // Tạo token
          const token = this.generateToken(newUser.id, newUser.phoneNumber);

          observer.next({
            success: true,
            message: 'Đăng ký thành công',
            data: {
              user: {
                id: newUser.id,
                phoneNumber: newUser.phoneNumber,
                fullName: newUser.fullName,
                email: newUser.email,
                createdAt: newUser.createdAt,
                updatedAt: newUser.updatedAt,
              },
              token,
            },
          });
          observer.complete();
        } catch (error) {
          observer.error({
            success: false,
            message: 'Có lỗi xảy ra khi đăng ký',
          });
        }
      }, 1000); // Simulate network delay
    });
  }

 // Đăng nhập
  login(credentials: { phoneNumber: string; password: string }): Observable<AuthResponse> {
    return new Observable((observer) => {
      setTimeout(() => {
        try {
          const users = this.getUsers();
          const user = users.find((u) => u.phoneNumber === credentials.phoneNumber);

          if (!user || !this.comparePassword(credentials.password, user.passwordHash)) {
            observer.next({
              success: false,
              message: 'Số điện thoại hoặc mật khẩu không đúng',
            });
            observer.complete();
            return;
          }

 // Tạo token
          const token = this.generateToken(user.id, user.phoneNumber);

          observer.next({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
              user: {
                id: user.id,
                phoneNumber: user.phoneNumber,
                fullName: user.fullName,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
              token,
            },
          });
          observer.complete();
        } catch (error) {
          observer.error({
            success: false,
            message: 'Có lỗi xảy ra khi đăng nhập',
          });
        }
      }, 1000);
    });
  }

 // Quên mật khẩu
  forgotPassword(phoneNumber: string): Observable<any> {
    return new Observable((observer) => {
      setTimeout(() => {
        try {
          const users = this.getUsers();
          const user = users.find((u) => u.phoneNumber === phoneNumber);

          if (!user) {
            observer.next({
              success: false,
              message: 'Số điện thoại chưa được đăng ký',
            });
            observer.complete();
            return;
          }

 // Tạo OTP
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const otpRecord: OTPRecord = {
            id: this.generateId(),
            phoneNumber,
            otp,
            createdAt: new Date().toISOString(),
            isUsed: false,
          };

 // Lưu OTP
          const otps = this.getOTPs();
          otps.push(otpRecord);
          this.saveOTPs(otps);

          observer.next({
            success: true,
            message: 'Mã OTP đã được gửi đến số điện thoại của bạn',
            data: {
              phoneNumber,
              otp, // Chỉ để test
              expiresIn: '5 phút',
            },
          });
          observer.complete();
        } catch (error) {
          observer.error({
            success: false,
            message: 'Có lỗi xảy ra',
          });
        }
      }, 1000);
    });
  }

 // Reset mật khẩu
  resetPassword(resetData: {
    phoneNumber: string;
    newPassword: string;
    otp: string;
  }): Observable<any> {
    return new Observable((observer) => {
      setTimeout(() => {
        try {
          const otps = this.getOTPs();
          const otpRecord = otps.find(
            (o) => o.phoneNumber === resetData.phoneNumber && o.otp === resetData.otp && !o.isUsed
          );

          if (!otpRecord) {
            observer.next({
              success: false,
              message: 'Mã OTP không đúng hoặc đã được sử dụng',
            });
            observer.complete();
            return;
          }

 // Kiểm tra OTP có hết hạn không (5 phút)
          const now = new Date();
          const otpTime = new Date(otpRecord.createdAt);
          const diffInMinutes = (now.getTime() - otpTime.getTime()) / (1000 * 60);

          if (diffInMinutes > 5) {
            observer.next({
              success: false,
              message: 'Mã OTP đã hết hạn',
            });
            observer.complete();
            return;
          }

 // Cập nhật mật khẩu
          const users = this.getUsers();
          const userIndex = users.findIndex((u) => u.phoneNumber === resetData.phoneNumber);

          if (userIndex === -1) {
            observer.next({
              success: false,
              message: 'Không tìm thấy tài khoản',
            });
            observer.complete();
            return;
          }

          users[userIndex].passwordHash = this.hashPassword(resetData.newPassword);
          users[userIndex].updatedAt = new Date().toISOString();
          this.saveUsers(users);

 // Đánh dấu OTP đã sử dụng
          otpRecord.isUsed = true;
          this.saveOTPs(otps);

          observer.next({
            success: true,
            message: 'Đặt lại mật khẩu thành công',
          });
          observer.complete();
        } catch (error) {
          observer.error({
            success: false,
            message: 'Có lỗi xảy ra khi đặt lại mật khẩu',
          });
        }
      }, 1000);
    });
  }

 // Lấy tất cả users (để debug)
  getAllUsers(): User[] {
    return this.getUsers();
  }

 // Lấy tất cả OTPs (để debug)
  getAllOTPs(): OTPRecord[] {
    return this.getOTPs();
  }

 // Xóa tất cả dữ liệu (để test)
  clearAllData(): void {
    localStorage.removeItem(this.USERS_KEY);
    localStorage.removeItem(this.OTP_KEY);
    this.initializeStorage();
  }

 // Send OTP for registration
  sendOtp(phoneNumber: string): Observable<any> {
 console.log(' Sending OTP for registration to:', phoneNumber);

 // Generate OTP với điều kiện: 400000-600000 và số cuối chẵn
    const otp = this.generateValidOtp();

 // Store OTP in localStorage
    const otpRecords = this.getOTPs();
    const newOtpRecord: OTPRecord = {
      id: Date.now().toString(),
      phoneNumber,
      otp,
      createdAt: new Date().toISOString(),
      isUsed: false,
    };

    otpRecords.push(newOtpRecord);
    localStorage.setItem(this.OTP_KEY, JSON.stringify(otpRecords));

    return of({
      success: true,
      message: 'OTP đã được gửi đến số điện thoại của bạn',
      otp: otp, // For demo purposes
    }).pipe(delay(1000));
  }

 // Send OTP for forgot password
  sendForgotPasswordOtp(phoneNumber: string): Observable<any> {
 console.log(' Sending OTP for forgot password to:', phoneNumber);

 // Generate OTP với điều kiện: 400000-600000 và số cuối chẵn
    const otp = this.generateValidOtp();

 // Store OTP in localStorage
    const otpRecords = this.getOTPs();
    const newOtpRecord: OTPRecord = {
      id: Date.now().toString(),
      phoneNumber,
      otp,
      createdAt: new Date().toISOString(),
      isUsed: false,
    };

    otpRecords.push(newOtpRecord);
    localStorage.setItem(this.OTP_KEY, JSON.stringify(otpRecords));

    return of({
      success: true,
      message: 'OTP đã được gửi đến số điện thoại của bạn',
      otp: otp, // For demo purposes
    }).pipe(delay(1000));
  }

 // Verify OTP for registration
  verifyOtp(phoneNumber: string, otp: string): Observable<any> {
 console.log(' Verifying OTP for registration:', { phoneNumber, otp });

    const otpRecords = this.getOTPs();
    const validOtp = otpRecords.find(
      (record: OTPRecord) =>
        record.phoneNumber === phoneNumber && record.otp === otp && !record.isUsed
    );

    if (validOtp) {
 // Mark OTP as used
      validOtp.isUsed = true;
      localStorage.setItem(this.OTP_KEY, JSON.stringify(otpRecords));

      return of({
        success: true,
        message: 'OTP xác thực thành công',
      }).pipe(delay(500));
    } else {
      return throwError({
        status: 400,
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
      }).pipe(delay(500));
    }
  }

 // Verify OTP for forgot password
  verifyForgotPasswordOtp(phoneNumber: string, otp: string): Observable<any> {
 console.log(' Verifying OTP for forgot password:', { phoneNumber, otp });

    const otpRecords = this.getOTPs();
    const validOtp = otpRecords.find(
      (record: OTPRecord) =>
        record.phoneNumber === phoneNumber && record.otp === otp && !record.isUsed
    );

    if (validOtp) {
 // Mark OTP as used
      validOtp.isUsed = true;
      localStorage.setItem(this.OTP_KEY, JSON.stringify(otpRecords));

      return of({
        success: true,
        message: 'OTP xác thực thành công',
      }).pipe(delay(500));
    } else {
      return throwError({
        status: 400,
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
      }).pipe(delay(500));
    }
  }
}
