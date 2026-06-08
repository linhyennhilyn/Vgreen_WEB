import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ApiConfigService } from './api-config.service';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Signal để track trạng thái đăng nhập
  isAuthenticated = signal<boolean>(false);
  currentUser = signal<AdminUser | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router,
    private supabase: SupabaseService,
    private apiConfig: ApiConfigService
  ) {
    // Kiểm tra xem có session không khi khởi động
    this.checkSession();
  }

  /**
   * Get API endpoint URL
   */
  private getApiUrl(endpoint: string): string {
    return this.apiConfig.getApiEndpoint(endpoint);
  }

  /**
   * Kiểm tra session hiện tại
   */
  private checkSession(): void {
    const authToken = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('admin_user');
    
    if (authToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.isAuthenticated.set(true);
        this.currentUser.set(user);
      } catch (e) {
        this.clearSession();
      }
    }
  }

  /**
   * Đăng nhập
   * Gọi API backend để xác thực admin từ MongoDB collection 'admins' hoặc 'users'
   */
  login(email: string, password: string): Observable<boolean> {
    console.log('🔹 AuthService.login() called (Supabase)');
    console.log(`   Email: ${email}`);

    return from(
      this.supabase.client.auth.signInWithPassword({
        email,
        password,
      })
    ).pipe(
      map((result) => {
        if (result.error) {
          console.error('❌ Supabase login error:', result.error);
          throw result.error;
        }

        const user = {
          id: result.data.user?.id || 0,
          email: result.data.user?.email || email,
          name:
            result.data.user?.user_metadata?.['displayName'] ||
            result.data.user?.user_metadata?.['name'] ||
            '',
          role: result.data.user?.user_metadata?.['role'] || 'admin',
        } as AdminUser;

        const token = result.data.session?.access_token || '';

        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));
        this.isAuthenticated.set(true);
        this.currentUser.set(user);

        console.log('✅ Supabase login successful');
        return true;
      }),
      catchError((error: HttpErrorResponse | Error) => {
        console.error('❌ AuthService: Supabase login error:', error);

        if (error instanceof Error && error.name === 'TimeoutError') {
          const timeoutError = new HttpErrorResponse({
            error: { message: 'Request timeout. Vui lòng kiểm tra kết nối mạng và thử lại.' },
            status: 408,
            statusText: 'Request Timeout',
          });
          throw timeoutError;
        }

        if (error instanceof HttpErrorResponse && error.status === 0) {
          const networkError = new HttpErrorResponse({
            error: { message: 'Không kết nối được với Supabase. Vui lòng kiểm tra kết nối mạng.' },
            status: 0,
            statusText: 'Network Error',
          });
          throw networkError;
        }

        throw error;
      })
    );
  }

  /**
   * Đăng xuất
   */
  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Xóa session
   */
  private clearSession(): void {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }

  /**
   * Lấy token hiện tại
   */
  getToken(): string | null {
    return localStorage.getItem('admin_token');
  }

  /**
   * Kiểm tra email để reset password
   * Trả về full response bao gồm OTP (trong development mode)
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post<any>(this.getApiUrl('/auth/forgot-password'), { email })
      .pipe(
        timeout(10000), // 10 seconds timeout
        map(response => {
          console.log('📧 Password reset response:', response);
          return response;
        }),
        catchError((error: HttpErrorResponse | Error) => {
          console.error('Password reset request error:', error);
          
          // Xử lý timeout
          if (error instanceof Error && error.name === 'TimeoutError') {
            throw new HttpErrorResponse({
              error: { message: 'Request timeout. Vui lòng thử lại.' },
              status: 408,
              statusText: 'Request Timeout'
            });
          }
          
          // Xử lý network error
          if (error instanceof HttpErrorResponse && error.status === 0) {
            throw new HttpErrorResponse({
              error: { message: 'Không kết nối được với server. Vui lòng kiểm tra backend đang chạy.' },
              status: 0,
              statusText: 'Network Error'
            });
          }
          
          throw error;
        })
      );
  }

  /**
   * Xác thực mã OTP
   */
  verifyOTP(email: string, otp: string): Observable<any> {
    return this.http.post<any>(this.getApiUrl('/auth/verify-otp'), { 
      email, 
      otp 
    }).pipe(
      timeout(10000), // 10 seconds timeout
      map(response => {
        console.log('✅ OTP verification response:', response);
        return response;
      }),
      catchError((error: HttpErrorResponse | Error) => {
        console.error('❌ OTP verification error:', error);
        
        // Xử lý timeout và network error
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new HttpErrorResponse({
            error: { message: 'Request timeout. Vui lòng thử lại.' },
            status: 408,
            statusText: 'Request Timeout'
          });
        }
        
        if (error instanceof HttpErrorResponse && error.status === 0) {
          throw new HttpErrorResponse({
            error: { message: 'Không kết nối được với server. Vui lòng kiểm tra backend đang chạy.' },
            status: 0,
            statusText: 'Network Error'
          });
        }
        
        throw error;
      })
    );
  }

  /**
   * Reset password với OTP
   */
  resetPassword(email: string, otp: string, newPassword: string): Observable<boolean> {
    return this.http.post<any>(this.getApiUrl('/auth/reset-password'), { 
      email, 
      otp, 
      newPassword 
    }).pipe(
      timeout(10000), // 10 seconds timeout
      map(response => true),
      catchError((error: HttpErrorResponse | Error) => {
        console.error('Password reset error:', error);
        
        // Xử lý timeout và network error
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new HttpErrorResponse({
            error: { message: 'Request timeout. Vui lòng thử lại.' },
            status: 408,
            statusText: 'Request Timeout'
          });
        }
        
        if (error instanceof HttpErrorResponse && error.status === 0) {
          throw new HttpErrorResponse({
            error: { message: 'Không kết nối được với server. Vui lòng kiểm tra backend đang chạy.' },
            status: 0,
            statusText: 'Network Error'
          });
        }
        
        throw error;
      })
    );
  }
}

