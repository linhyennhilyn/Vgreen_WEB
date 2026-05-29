import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SupportItem {
  id: number;
  icon: string;
  iconPath: string;
  title: string;
  content: string;
  isExpanded: boolean;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  isExpanded: boolean;
}

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './support.html',
  styleUrls: ['./support.css'],
})
export class Support implements OnInit {
  // Popup state
  showPopup = false;
  popupMessage = '';
  popupType: 'success' | 'error' = 'success';
  isSubmitting = false;

  faqItems: FAQItem[] = [
    {
      id: 1,
      question: 'Tôi có thể hủy đơn hàng sau khi đặt không?',
      answer:
        'Bạn có thể hủy đơn hàng trong thời gian chờ xác nhận. Sau thời gian này, đơn hàng đã được xử lý và không thể hủy.',
      isExpanded: false,
    },
    {
      id: 2,
      question: 'Thời gian giao hàng của VGreen là bao lâu?',
      answer:
        'Chúng tôi luôn cố gắng giao hàng nhanh nhất để rau củ đến tay bạn vẫn tươi ngon như vừa hái:<br><br><strong>• Nội thành HN/HCM:</strong> 2 – 4 giờ<br><strong>• Ngoại thành:</strong> 24 – 48 giờ<br><strong>• Các tỉnh khác:</strong> 2 – 5 ngày làm việc<br><br>Thời gian có thể thay đổi nhẹ tùy vào điều kiện thời tiết hoặc lưu thông, nhưng VGreen sẽ luôn cập nhật cho bạn trong suốt quá trình vận chuyển',
      isExpanded: false,
    },
    {
      id: 3,
      question: 'Nếu sản phẩm có vấn đề thì sao?',
      answer:
        'VGreen cam kết mang đến nông sản tươi – sạch – đúng chất lượng. Nếu sản phẩm gặp lỗi, bạn chỉ cần:<br><br>1. Chụp ảnh hoặc quay video sản phẩm lỗi<br>2. Gọi hotline <strong>0123 456 789</strong> hoặc gửi email <strong>vgreenhotro@gmail.com</strong><br>3. VGreen phản hồi trong vòng <strong>2 giờ làm việc</strong><br>4. Bạn được đổi sản phẩm mới hoặc hoàn tiền 100%<br><br>Chúng tôi luôn mong mỗi trải nghiệm của bạn với VGreen đều trọn vẹn',
      isExpanded: false,
    },
    {
      id: 4,
      question: 'Phí vận chuyển được tính như thế nào?',
      answer:
        'Phí ship được tính theo khu vực và giá trị đơn hàng:<br><br><strong>• Miễn phí ship:</strong> Đơn từ 200.000₫ (nội thành)<br><strong>• Nội thành:</strong> 25.000₫ (đơn dưới 200.000₫)<br><strong>• Ngoại thành:</strong> 35.000₫<br><strong>• Tỉnh xa:</strong> Từ 30.000₫/kg',
      isExpanded: false,
    },
    {
      id: 5,
      question: 'Làm sao để nhận mã giảm giá?',
      answer:
        'VGreen luôn có nhiều cách để bạn được ưu đãi:<br><br>• Đăng ký tài khoản mới – <strong>giảm 10%</strong> cho đơn đầu tiên<br>• Theo dõi fanpage VGreen để cập nhật khuyến mãi sớm nhất<br>• Tham gia chương trình tích điểm đổi voucher hấp dẫn<br>• Nhận mã ưu đãi đặc biệt trong các dịp lễ và mùa vụ.',
      isExpanded: false,
    },
  ];

  supportItems: SupportItem[] = [
    {
      id: 1,
      icon: 'faq',
      iconPath: '/asset/icons/info_dark.png',
      title: 'Câu hỏi thường gặp',
      content: `
        <div class="faq-list">
          <div class="faq-item">
            <h4>Tôi có thể hủy đơn hàng sau khi đặt không?</h4>
            <p>Bạn có thể hủy đơn hàng trong thời gian chờ xác nhận. Sau thời gian này, đơn hàng đã được xử lý và không thể hủy.</p>
          </div>
          
          <div class="faq-item">
            <h4>Thời gian giao hàng của VGreen là bao lâu?</h4>
            <p>Chúng tôi luôn cố gắng giao hàng nhanh nhất để rau củ đến tay bạn vẫn tươi ngon như vừa hái:</p>
            <ul>
              <li><strong>Nội thành HN/HCM:</strong> 2 – 4 giờ</li>
              <li><strong>Ngoại thành:</strong> 24 – 48 giờ</li>
              <li><strong>Các tỉnh khác:</strong> 2 – 5 ngày làm việc</li>
            </ul>
            <p>Thời gian có thể thay đổi nhẹ tùy vào điều kiện thời tiết hoặc lưu thông, nhưng VGreen sẽ luôn cập nhật cho bạn trong suốt quá trình vận chuyển</p>
          </div>
          
          <div class="faq-item">
            <h4>Nếu sản phẩm có vấn đề thì sao?</h4>
            <p>VGreen cam kết mang đến nông sản tươi – sạch – đúng chất lượng.  
            Nếu sản phẩm gặp lỗi, bạn chỉ cần:</p>
            <ol>
              <li>Chụp ảnh hoặc quay video sản phẩm lỗi</li>
              <li>Gọi hotline <strong>0123 456 789</strong> hoặc gửi email <strong>vgreenhotro@gmail.com</strong></li>
              <li>VGreen phản hồi trong vòng <strong>2 giờ làm việc</strong></li>
              <li>Bạn được đổi sản phẩm mới hoặc hoàn tiền 100%</li>
            </ol>
            <p>Chúng tôi luôn mong mỗi trải nghiệm của bạn với VGreen đều trọn vẹn</p>
          </div>
          
          <div class="faq-item">
            <h4>Phí vận chuyển được tính như thế nào?</h4>
            <p>Phí ship được tính theo khu vực và giá trị đơn hàng:</p>
            <ul>
              <li><strong>Miễn phí ship:</strong> Đơn từ 200.000₫ (nội thành)</li>
              <li><strong>Nội thành:</strong> 25.000₫ (đơn dưới 200.000₫)</li>
              <li><strong>Ngoại thành:</strong> 35.000₫</li>
              <li><strong>Tỉnh xa:</strong> Từ 30.000₫/kg</li>
            </ul>
          </div>
          
          <div class="faq-item">
            <h4>Làm sao để nhận mã giảm giá?</h4>
            <p>VGreen luôn có nhiều cách để bạn được ưu đãi:</p>
            <ul>
              <li>Đăng ký tài khoản mới – <strong>giảm 10%</strong> cho đơn đầu tiên</li>
              <li>Theo dõi fanpage VGreen để cập nhật khuyến mãi sớm nhất</li>
              <li>Tham gia chương trình tích điểm đổi voucher hấp dẫn</li>
              <li>Nhận mã ưu đãi đặc biệt trong các dịp lễ và mùa vụ.</li>
            </ul>
          </div>
        </div>
      `,
      isExpanded: false,
    },
    {
      id: 2,
      icon: 'guide',
      iconPath: '/asset/icons/history_dark.png',
      title: 'Hướng dẫn đặt hàng',
      content: `
        <div class="order-guide">
          <div class="step-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Chọn sản phẩm yêu thích</h4>
              <p>Duyệt qua danh mục nông sản tươi, chọn loại rau – củ – quả mà bạn muốn.  
              Nhấn “Thêm vào giỏ” để lưu sản phẩm, hoặc xem chi tiết nguồn gốc, quy trình trồng và bảo quản.</p>
            </div>
          </div>
          
          <div class="step-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Xem giỏ hàng & áp dụng mã giảm giá</h4>
              <p>Vào giỏ hàng để kiểm tra số lượng, giá trị đơn.  
              Nếu có mã giảm giá, hãy nhập vào ô “Mã khuyến mãi” để được ưu đãi ngay</p>
            </div>
          </div>
          
          <div class="step-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Điền thông tin & thanh toán</h4>
              <p>Nhập địa chỉ nhận hàng, số điện thoại và chọn hình thức thanh toán (COD, chuyển khoản, ví điện tử).  
              Sau khi xác nhận, VGreen sẽ xử lý đơn hàng ngay để giao sớm nhất có thể.</p>
            </div>
          </div>
          
          <div class="step-item">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4>Theo dõi đơn hàng</h4>
              <p>Bạn sẽ nhận được email xác nhận kèm mã đơn.  
              Dùng mã này để tra cứu tình trạng đơn hàng trên website hoặc liên hệ hotline nếu cần hỗ trợ.</p>
            </div>
          </div>
        </div>
      `,
      isExpanded: false,
    },
    {
      id: 3,
      icon: 'return',
      iconPath: '/asset/icons/return_dark.png',
      title: 'Hướng dẫn đổi trả',
      content: `
        <h4>Điều kiện đổi trả</h4>
        <ul>
          <li>Đổi trả trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng</li>
          <li>Sản phẩm còn nguyên vẹn, chưa qua sử dụng</li>
          <li>Có đầy đủ hóa đơn và bao bì gốc</li>
          <li>Đối với nông sản tươi sống: đổi trả trong <strong>24 giờ</strong> nếu có lỗi</li>
        </ul>
        
        <h4>Quy trình gửi yêu cầu đổi trả</h4>
        <ol>
          <li><strong>Chụp ảnh/quay video:</strong> Ghi lại tình trạng sản phẩm cần đổi trả</li>
          <li><strong>Liên hệ hỗ trợ:</strong> Gọi hotline <strong>0123 456 789</strong> hoặc email <strong>vgreenhotro@gmail.com</strong></li>
          <li><strong>Chờ xác nhận:</strong> Nhân viên sẽ xác nhận yêu cầu trong vòng 2 giờ</li>
          <li><strong>Đóng gói:</strong> Đóng gói sản phẩm và chờ nhân viên đến lấy</li>
        </ol>
        
        <h4>Thời gian xử lý</h4>
        <ul>
          <li><strong>Xác nhận yêu cầu:</strong> Trong vòng 2 giờ làm việc</li>
          <li><strong>Lấy hàng:</strong> 24-48 giờ (tùy khu vực)</li>
          <li><strong>Hoàn tiền/đổi hàng:</strong> 3-5 ngày làm việc</li>
        </ul>
        
        <div class="note">
          <strong>Lưu ý quan trọng:</strong>
          <ul>
            <li>Sản phẩm tươi sống cần chụp ảnh ngay khi nhận hàng</li>
            <li>Chi phí vận chuyển đổi trả do VGreen chịu (nếu lỗi từ phía chúng tôi)</li>
            <li>Hoàn tiền qua cùng phương thức thanh toán ban đầu</li>
          </ul>
        </div>
      `,
      isExpanded: false,
    },
  ];

  contactData: ContactForm = {
    name: '',
    email: '',
    message: '',
  };

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Scroll to top khi component load
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Đọc query parameter để mở section tương ứng
    this.route.queryParams.subscribe((params) => {
      const openSection = params['open'];
      if (openSection) {
        this.openSpecificSection(openSection);
      }
    });
  }

  // Mở section cụ thể dựa trên query parameter
  openSpecificSection(sectionType: string): void {
    const sectionMap: { [key: string]: number } = {
      faq: 1, // Câu hỏi thường gặp
      order: 2, // Hướng dẫn đặt hàng
      return: 3, // Hướng dẫn đổi trả
    };

    const sectionId = sectionMap[sectionType];
    if (sectionId) {
      // Đóng tất cả section khác trước
      this.supportItems.forEach((s) => (s.isExpanded = false));

      // Mở section được chọn
      const section = this.supportItems.find((s) => s.id === sectionId);
      if (section) {
        section.isExpanded = true;
        console.log('Opened section:', section.title);
      }
    }
  }

  // Toggle accordion
  toggleAccordion(supportId: number): void {
    const support = this.supportItems.find((s) => s.id === supportId);
    if (support) {
      console.log('Before toggle:', support.title, 'isExpanded:', support.isExpanded);

      // Multiple can be open
      support.isExpanded = !support.isExpanded;

      console.log('After toggle:', support.title, 'isExpanded:', support.isExpanded);

      // Force change detection
      setTimeout(() => {
        console.log('Final state:', support.title, 'isExpanded:', support.isExpanded);
      }, 100);
    } else {
      console.error('Support item not found with id:', supportId);
    }
  }

  // Toggle FAQ accordion
  toggleFAQ(faqId: number): void {
    const faq = this.faqItems.find((f) => f.id === faqId);
    if (faq) {
      faq.isExpanded = !faq.isExpanded;
    }
  }

  // Submit contact form
  onSubmit(): void {
    if (!this.contactData.name || !this.contactData.email || !this.contactData.message) {
      this.showPopupMessage('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.contactData.email)) {
      this.showPopupMessage('Email không hợp lệ', 'error');
      return;
    }

    this.isSubmitting = true;

    // Gửi email qua API
    this.http
      .post<any>('http://localhost:3000/api/contact/send', {
        name: this.contactData.name,
        email: this.contactData.email,
        message: this.contactData.message,
      })
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.showPopupMessage(
              'Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 24 giờ.',
              'success'
            );
            // Reset form
            this.contactData = {
              name: '',
              email: '',
              message: '',
            };
          } else {
            this.showPopupMessage(
              response.message || 'Có lỗi xảy ra. Vui lòng thử lại sau.',
              'error'
            );
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Error sending contact form:', error);
          const errorMessage =
            error.error?.message || 'Có lỗi xảy ra khi gửi email. Vui lòng thử lại sau.';
          this.showPopupMessage(errorMessage, 'error');
        },
      });
  }

  showPopupMessage(message: string, type: 'success' | 'error'): void {
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;

    // Auto close after 5 seconds for success, 7 seconds for error
    const timeout = type === 'success' ? 5000 : 7000;
    setTimeout(() => {
      this.closePopup();
    }, timeout);
  }

  closePopup(): void {
    this.showPopup = false;
    this.popupMessage = '';
  }
}
