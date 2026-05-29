import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['login', 'requestPasswordReset', 'resetPassword']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [Login, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display login form by default', () => {
    expect(component.currentView()).toBe('login');
  });

  it('should show error when login with empty credentials', () => {
    component.loginForm.email = '';
    component.loginForm.password = '';
    component.onLogin();
    expect(component.errorMessage()).toBe('Vui lòng nhập đầy đủ email và mật khẩu');
  });

  it('should call authService.login when form is valid', () => {
    authService.login.and.returnValue(of(true));
    component.loginForm.email = 'test@example.com';
    component.loginForm.password = 'password123';
    
    component.onLogin();
    
    expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('should navigate to forgot password view', () => {
    component.goToForgotPassword();
    expect(component.currentView()).toBe('forgot-1');
  });

  it('should navigate back to login view', () => {
    component.currentView.set('forgot-1');
    component.backToLogin();
    expect(component.currentView()).toBe('login');
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });

  it('should validate OTP input to be numeric only', () => {
    const mockEvent = {
      target: {
        value: 'a'
      }
    };
    
    component.onOtpInput(0, mockEvent);
    expect(mockEvent.target.value).toBe('');
  });

  it('should accept numeric OTP input', () => {
    const mockEvent = {
      target: {
        value: '5',
        nextElementSibling: null
      }
    };
    
    component.onOtpInput(0, mockEvent);
    expect(component.resetPasswordForm.otp[0]).toBe('5');
  });
});

