import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ChatService, ProductCard } from '../services/chat.service';

interface ChatMessage {
  text: string;
  time: string;
  isBot: boolean;
  products?: ProductCard[];
}

@Component({
  selector: 'app-veebot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './veebot.html',
  styleUrl: './veebot.css',
})
export class Veebot implements OnInit, OnDestroy, AfterViewChecked {
  isChatOpen: boolean = false;
  hasNewMessage: boolean = false;
  inputMessage: string = '';
  messages: ChatMessage[] = [];
  isLoading: boolean = false;

  @ViewChild('chatMessages') chatMessages!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private shouldScrollToBottom: boolean = false;
  private welcomeMessages: string[] = [
    'Xin chào! Tôi là Veebot, trợ lý ảo của VGreen. Tôi có thể giúp gì cho bạn?',
  ];

  constructor(
    private chatService: ChatService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Thêm tin nhắn chào mừng khi component khởi tạo
    this.addWelcomeMessages();
    
    // Load chat history nếu có
    this.loadChatHistory();
  }

  /**
   * Load chat history từ API
   */
  private loadChatHistory(): void {
    this.chatService.getHistory().subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.messages && response.data.messages.length > 0) {
          // Convert API messages to component messages
          // Chỉ load các messages từ user và assistant (bỏ system messages)
          const userMessages = response.data.messages
            .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
            .map((msg) => ({
              text: msg.content,
              time: this.formatTimeFromDate(msg.timestamp || new Date()),
              isBot: msg.role === 'assistant',
            }));

          // Chỉ thêm messages nếu có (không thêm welcome message nếu đã có history)
          if (userMessages.length > 0) {
            // Xóa welcome message nếu đã có history
            if (this.messages.length > 0 && this.messages[0].isBot) {
              this.messages = [];
            }
            this.messages.push(...userMessages);
            this.shouldScrollToBottom = true;
          }
        }
      },
      error: (error) => {
        console.error('Error loading chat history:', error);
        // Không block UI nếu lỗi load history
      },
    });
  }

  /**
   * Format time from Date object
   */
  private formatTimeFromDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  ngAfterViewChecked(): void {
    // Tự động scroll xuống cuối khi có tin nhắn mới
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    // Dọn dẹp nếu cần
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;

    if (this.isChatOpen) {
      // Đánh dấu không còn tin nhắn mới khi mở chat
      this.hasNewMessage = false;

      // Tập trung vào ô nhập sau khi mở
      setTimeout(() => {
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      }, 300);
    }
  }

  closeChat(): void {
    this.isChatOpen = false;
  }

  sendMessage(): void {
    if (!this.inputMessage || !this.inputMessage.trim() || this.isLoading) {
      return;
    }

    // Lưu tin nhắn trước khi clear
    const messageText = this.inputMessage.trim();

    // Thêm tin nhắn của người dùng
    const userMessage: ChatMessage = {
      text: messageText,
      time: this.getCurrentTime(),
      isBot: false,
    };

    this.messages.push(userMessage);

    // Clear input ngay lập tức
    this.inputMessage = '';

    // Đảm bảo input được clear trong DOM
    if (this.messageInput) {
      this.messageInput.nativeElement.value = '';
    }

    this.shouldScrollToBottom = true;
    this.isLoading = true;

    // Lấy userId từ localStorage nếu có
    const userStr = localStorage.getItem('user');
    let userId: string | undefined;
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userId = user.CustomerID || user._id || user.id;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    // Gọi API để nhận phản hồi từ AI
    this.chatService.sendMessage(messageText, userId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const botMessage: ChatMessage = {
            text: response.data.message,
            time: this.getCurrentTime(),
            isBot: true,
            products: response.data.products || undefined, // Thêm danh sách sản phẩm nếu có
          };

          this.messages.push(botMessage);
          this.shouldScrollToBottom = true;

          // Đánh dấu có tin nhắn mới nếu chat đang đóng
          if (!this.isChatOpen) {
            this.hasNewMessage = true;
          }
        } else {
          // Fallback to local response nếu API lỗi
          this.handleBotResponseFallback(messageText);
        }
        this.isLoading = false;

        // Focus lại input sau khi nhận phản hồi
        setTimeout(() => {
          if (this.messageInput) {
            this.messageInput.nativeElement.focus();
          }
        }, 100);
      },
      error: (error) => {
        console.error('Error sending message:', error);
        // Fallback to local response
        this.handleBotResponseFallback(messageText);
        this.isLoading = false;

        // Focus lại input sau khi lỗi
        setTimeout(() => {
          if (this.messageInput) {
            this.messageInput.nativeElement.focus();
          }
        }, 100);
      },
    });
  }

  /**
   * Fallback response handler - Sử dụng khi API lỗi
   */
  private handleBotResponseFallback(userMessage: string): void {
    const lowerMessage = userMessage.toLowerCase();
    let botResponse: string = '';

    // Xử lý các câu hỏi phổ biến
    if (lowerMessage.includes('sản phẩm') || lowerMessage.includes('product')) {
      botResponse =
        'VGreen có nhiều sản phẩm chất lượng cao như rau củ hữu cơ, trái cây, thực phẩm khô, trà và cà phê. Bạn có thể xem danh sách sản phẩm tại trang chủ hoặc tìm kiếm sản phẩm cụ thể!';
    } else if (lowerMessage.includes('đơn hàng') || lowerMessage.includes('order')) {
      botResponse =
        'Để kiểm tra đơn hàng, vui lòng đăng nhập vào tài khoản của bạn và truy cập phần "Quản lý đơn hàng". Nếu bạn chưa có tài khoản, hãy đăng ký để theo dõi đơn hàng dễ dàng hơn!';
    } else if (
      lowerMessage.includes('hỗ trợ') ||
      lowerMessage.includes('support') ||
      lowerMessage.includes('help')
    ) {
      botResponse =
        'Bạn có thể liên hệ với chúng tôi qua:\n- Hotline: 0125 456 789\n- Email: vgreenhotro@gmail.com\n- Hoặc truy cập trang "Hỗ trợ" để được giải đáp các câu hỏi thường gặp!';
    } else if (
      lowerMessage.includes('giá') ||
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost')
    ) {
      botResponse =
        'Giá sản phẩm được hiển thị trên từng trang sản phẩm. VGreen cam kết mang đến giá cả hợp lý và chất lượng tốt nhất cho khách hàng!';
    } else if (
      lowerMessage.includes('giao hàng') ||
      lowerMessage.includes('delivery') ||
      lowerMessage.includes('ship')
    ) {
      botResponse =
        'VGreen giao hàng toàn quốc. Thời gian giao hàng thường từ 1-3 ngày tùy khu vực. Bạn có thể xem chi tiết chính sách giao hàng tại trang "Chính sách"!';
    } else if (
      lowerMessage.includes('đổi trả') ||
      lowerMessage.includes('return') ||
      lowerMessage.includes('refund')
    ) {
      botResponse =
        'VGreen có chính sách đổi trả trong vòng 7 ngày nếu sản phẩm không đúng chất lượng. Chi tiết xem tại trang "Chính sách đổi trả"!';
    } else if (lowerMessage.includes('cảm ơn') || lowerMessage.includes('thank')) {
      botResponse =
        'Không có gì! Rất vui được hỗ trợ bạn. Nếu có thêm câu hỏi nào, đừng ngại hỏi tôi nhé!';
    } else if (
      lowerMessage.includes('xin chào') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi')
    ) {
      botResponse = 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?';
    } else {
      botResponse =
        'Cảm ơn bạn đã liên hệ! Tôi hiểu bạn đang hỏi về: "' +
        userMessage +
        '".\n\nĐể được hỗ trợ tốt hơn, bạn có thể:\n- Gọi hotline: 0125 456 789\n- Email: vgreenhotro@gmail.com\n- Hoặc truy cập trang "Hỗ trợ" để xem các câu hỏi thường gặp!';
    }

    const botMessage: ChatMessage = {
      text: botResponse,
      time: this.getCurrentTime(),
      isBot: true,
    };

    this.messages.push(botMessage);
    this.shouldScrollToBottom = true;

    // Đánh dấu có tin nhắn mới nếu chat đang đóng
    if (!this.isChatOpen) {
      this.hasNewMessage = true;
    }
  }

  private addWelcomeMessages(): void {
    // Thêm tin nhắn chào mừng ban đầu
    const welcomeMessage: ChatMessage = {
      text: this.welcomeMessages[0],
      time: this.getCurrentTime(),
      isBot: true,
    };
    this.messages.push(welcomeMessage);
  }

  private scrollToBottom(): void {
    if (this.chatMessages) {
      const element = this.chatMessages.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  formatMessage(text: string): string {
    // Thay \n thành <br> để hiển thị xuống dòng đúng chỗ
    return text.replace(/\n/g, '<br>');
  }

  /**
   * Chuyển hướng sang trang chi tiết sản phẩm
   */
  goToProductDetail(product: ProductCard): void {
    if (product && product._id) {
      this.router.navigate(['/product-detail', product._id]);
      // Đóng chat khi chuyển hướng
      this.closeChat();
    }
  }

  /**
   * Format giá tiền
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }
}
