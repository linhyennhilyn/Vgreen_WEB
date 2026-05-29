import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PaymentInfo {
  method: 'cod' | 'vnpay' | 'momo' | 'card' | 'banking';
  amount: number;
  orderId: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-method.html',
  styleUrl: './payment-method.css',
})
export class PaymentMethodComponent implements OnInit {
  @Input() paymentInfo: PaymentInfo = {
    method: 'cod',
    amount: 0,
    orderId: '',
  };

  @Output() paymentComplete = new EventEmitter<PaymentResult>();
  @Output() closeModal = new EventEmitter<void>();

 // Payment states 
  isProcessing = false;
  countdown = 0;
  countdownInterval: any;
  qrCodeUrl = '';
  paymentUrl = '';
  
  // Cancel confirmation popup
  showCancelConfirm = false;

 // Mock payment methods 
  paymentMethods = [
    {
      id: 'cod',
      name: 'Thanh toán khi nhận hàng',
      description: 'Bạn sẽ thanh toán khi nhận được hàng',
      icon: '💰',
      available: true,
    },
    {
      id: 'vnpay',
      name: 'VNPAY-QR',
      description: 'Thanh toán qua VNPAY QR Code',
      icon: '📱',
      available: true,
    },
    {
      id: 'momo',
      name: 'Momo',
      description: 'Thanh toán qua ví điện tử Momo',
      icon: '💳',
      available: true,
    },
    {
      id: 'card',
      name: 'Thẻ thanh toán quốc tế',
      description: 'Visa, Mastercard, JCB',
      icon: '💳',
      available: true,
    },
    {
      id: 'banking',
      name: 'Ứng dụng Mobile Banking',
      description: 'Vietcombank, Techcombank, BIDV...',
      icon: '🏦',
      available: true,
    },
  ];

  ngOnInit() {
 console.log('PaymentMethodComponent ngOnInit - paymentInfo:', this.paymentInfo); 
 console.log('PaymentMethodComponent ngOnInit - amount:', this.paymentInfo.amount); 

    if (this.paymentInfo.method !== 'cod') {
      this.startPaymentProcess();
    }
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  startPaymentProcess() {
    this.isProcessing = true;
    this.countdown = 300; // 5 minutes

 // Start countdown 
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.handlePaymentTimeout();
      }
    }, 1000);

 // Simulate API call to create payment 
    this.createPaymentSession();
  }

  async createPaymentSession() {
    try {
 // Mock API call 
      await new Promise((resolve) => setTimeout(resolve, 1000));

      switch (this.paymentInfo.method) {
        case 'vnpay':
          this.qrCodeUrl =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
          break;
        case 'momo':
          this.paymentUrl = 'https://momo.vn/payment';
          break;
        case 'card':
        case 'banking':
          this.paymentUrl = 'https://payment.gateway.com/checkout';
          break;
      }
    } catch (error) {
      this.handlePaymentError('Không thể tạo phiên thanh toán');
    }
  }

  onPaymentMethodSelect(method: string) {
    this.paymentInfo.method = method as any;
  }

  async onConfirmPayment() {
    if (this.paymentInfo.method === 'cod') {
      this.handlePaymentSuccess();
      return;
    }

    if (this.paymentInfo.method === 'vnpay' && this.qrCodeUrl) {
 // For VNPAY QR, user needs to scan and pay 
      this.showPaymentInstructions();
      return;
    }

    if (this.paymentUrl) {
 // Open payment gateway 
      window.open(this.paymentUrl, '_blank');
      this.startPaymentPolling();
    }
  }

  onPaymentCompleted() {
    this.handlePaymentSuccess();
  }

  onPaymentFailed() {
    // Show confirmation popup instead of directly canceling
    this.showCancelConfirm = true;
  }

  confirmCancelPayment() {
    this.showCancelConfirm = false;
    this.handlePaymentError('Thanh toán đã bị hủy');
  }

  cancelCancelPayment() {
    this.showCancelConfirm = false;
  }

  private handlePaymentSuccess() {
    this.isProcessing = false;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.paymentComplete.emit({
      success: true,
      transactionId: 'TXN_' + Date.now(),
    });
  }

  private handlePaymentError(error: string) {
    this.isProcessing = false;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.paymentComplete.emit({
      success: false,
      error: error,
    });
  }

  private handlePaymentTimeout() {
    this.handlePaymentError('Hết thời gian thanh toán');
  }

  private showPaymentInstructions() {
 // Show instructions for QR payment 
    alert('Vui lòng quét mã QR bằng ứng dụng VNPAY để thanh toán');
  }

  private startPaymentPolling() {
 // Poll payment status every 3 seconds 
    const pollInterval = setInterval(async () => {
      try {
 // Mock API call to check payment status 
        const status = await this.checkPaymentStatus();
        if (status === 'success') {
          clearInterval(pollInterval);
          this.handlePaymentSuccess();
        } else if (status === 'failed') {
          clearInterval(pollInterval);
          this.handlePaymentError('Thanh toán thất bại');
        }
      } catch (error) {
 // Continue polling 
      }
    }, 3000);

 // Stop polling after 5 minutes 
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  }

  private async checkPaymentStatus(): Promise<string> {
 // Mock API call 
    await new Promise((resolve) => setTimeout(resolve, 500));
    return Math.random() > 0.7 ? 'success' : 'pending';
  }

  onClose() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.closeModal.emit();
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
