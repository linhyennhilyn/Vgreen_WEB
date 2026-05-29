import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';

interface PolicyItem {
  id: number;
  icon: string;
  iconPath: string;
  title: string;
  content: string;
  isExpanded: boolean;
}

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './policy.html',
  styleUrls: ['./policy.css']
})
export class Policy implements OnInit {
  
  policies: PolicyItem[] = [
    {
      id: 1,
      icon: 'return',
      iconPath: '/asset/icons/return_dark.png',
      title: 'Chính sách đổi trả',
      content: `
        <h4>Thời gian đổi trả</h4>
        <p>Chúng tôi chấp nhận đổi trả trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng. Sản phẩm phải còn nguyên vẹn, chưa qua sử dụng và có đầy đủ hóa đơn, bao bì.</p>
        
        <h4>Điều kiện đổi trả nông sản tươi sống</h4>
        <p>Đối với nông sản tươi sống, thời gian đổi trả là <strong>24 giờ</strong> kể từ khi nhận hàng nếu:</p>
        <ul>
          <li>Sản phẩm bị hư hỏng do vận chuyển</li>
          <li>Sản phẩm không đúng chất lượng cam kết</li>
          <li>Sản phẩm giao sai loại hoặc thiếu số lượng</li>
        </ul>
        
        <h4>Quy trình đổi trả</h4>
        <ol>
          <li>Chụp ảnh/quay video sản phẩm cần đổi trả</li>
          <li>Liên hệ hotline <strong>0123 456 789</strong> hoặc email <strong>vgreenhotro@gmail.com</strong></li>
          <li>Đóng gói sản phẩm và chờ nhân viên đến lấy hàng</li>
          <li>Nhận sản phẩm mới hoặc hoàn tiền trong vòng 3-5 ngày làm việc</li>
        </ol>
        
        <p class="note"> <strong>Lưu ý:</strong> Chi phí vận chuyển đổi trả do cửa hàng chịu trong trường hợp lỗi từ phía chúng tôi.</p>
      `,
      isExpanded: false
    },
    {
      id: 2,
      icon: 'shop',
      iconPath: '/asset/icons/shop_dark.png',
      title: 'Chính sách thanh toán',
      content: `
        <h4>Các hình thức thanh toán được hỗ trợ</h4>
        <p>VGreen hỗ trợ đa dạng phương thức thanh toán để thuận tiện cho khách hàng:</p>
        
        <ul>
          <li><strong>Thanh toán khi nhận hàng (COD):</strong> Thanh toán trực tiếp cho nhân viên giao hàng. Phí COD: 15.000₫/đơn (miễn phí cho đơn từ 200.000₫)</li>
          <li><strong>Chuyển khoản ngân hàng:</strong> Chuyển khoản trực tiếp vào tài khoản VGreen</li>
          <li><strong>Ví điện tử:</strong> Momo, ZaloPay, VNPay, ShopeePay</li>
          <li><strong>Thẻ tín dụng/ghi nợ:</strong> Visa, Mastercard, JCB (qua cổng thanh toán OnePay)</li>
        </ul>
        
        <h4>Bảo mật thanh toán</h4>
        <p>Tất cả giao dịch thanh toán trực tuyến đều được mã hóa <strong>SSL 256-bit</strong> và xử lý qua cổng thanh toán uy tín đã được cấp phép. Chúng tôi không lưu trữ thông tin thẻ của khách hàng.</p>
        
        <h4>Chính sách hoàn tiền</h4>
        <p>Trường hợp hủy đơn hoặc đổi trả sản phẩm, tiền sẽ được hoàn lại trong vòng <strong>5-7 ngày làm việc</strong> (tùy phương thức thanh toán).</p>
      `,
      isExpanded: false
    },
    {
      id: 3,
      icon: 'protect',
      iconPath: '/asset/icons/protect_dark.png',
      title: 'Chính sách bảo mật',
      content: `
        <h4>Cam kết bảo mật thông tin</h4>
        <p>VGreen cam kết bảo vệ thông tin cá nhân của khách hàng theo <strong>Luật An toàn thông tin mạng</strong> và <strong>Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân.</p>
        
        <h4>Thông tin chúng tôi thu thập</h4>
        <ul>
          <li>Họ tên, số điện thoại, địa chỉ email</li>
          <li>Địa chỉ giao hàng</li>
          <li>Lịch sử mua hàng và tương tác với website</li>
        </ul>
        
        <h4>Mục đích sử dụng thông tin</h4>
        <ul>
          <li>Xử lý và giao hàng đơn hàng</li>
          <li>Tư vấn và chăm sóc khách hàng</li>
          <li>Gửi thông tin khuyến mãi (nếu khách hàng đồng ý)</li>
          <li>Cải thiện trải nghiệm người dùng</li>
        </ul>
        
        <h4>Bảo vệ dữ liệu</h4>
        <p>Chúng tôi sử dụng các biện pháp kỹ thuật tiên tiến:</p>
        <ul>
          <li>Mã hóa dữ liệu SSL/TLS</li>
          <li>Tường lửa và hệ thống phát hiện xâm nhập</li>
          <li>Sao lưu dữ liệu thường xuyên</li>
          <li>Kiểm soát quyền truy cập nghiêm ngặt</li>
        </ul>
        
        <p class="note">Chúng tôi <strong>KHÔNG BAO GIỜ</strong> chia sẻ thông tin cá nhân của bạn với bên thứ ba mà không có sự đồng ý.</p>
      `,
      isExpanded: false
    },
    {
      id: 4,
      icon: 'logistic',
      iconPath: '/asset/icons/logistic_dark.png',
      title: 'Chính sách giao hàng',
      content: `
        <h4>Khu vực giao hàng</h4>
        <p>VGreen hiện giao hàng trên toàn quốc <strong>63 tỉnh thành</strong> với hơn 200 điểm giao nhận.</p>
        
        <h4>Thời gian giao hàng</h4>
        <table class="shipping-table">
          <tr>
            <th>Khu vực</th>
            <th>Thời gian</th>
            <th>Ghi chú</th>
          </tr>
          <tr>
            <td>Nội thành HN/HCM</td>
            <td>2-4 giờ</td>
            <td>Giao hàng nhanh</td>
          </tr>
          <tr>
            <td>Ngoại thành & tỉnh lân cận</td>
            <td>24-48 giờ</td>
            <td>-</td>
          </tr>
          <tr>
            <td>Các tỉnh khác</td>
            <td>2-5 ngày làm việc</td>
            <td>Tùy khoảng cách</td>
          </tr>
        </table>
        
        <h4>Phí vận chuyển</h4>
        <ul>
          <li><strong>Miễn phí ship:</strong> Đơn hàng từ 200.000₫ (nội thành)</li>
          <li><strong>Nội thành:</strong> 25.000₫ (đơn dưới 200.000₫)</li>
          <li><strong>Ngoại thành:</strong> 35.000₫</li>
          <li><strong>Tỉnh xa:</strong> Tính theo cân nặng, từ 30.000₫/kg</li>
        </ul>
        
        <h4>Đóng gói & bảo quản</h4>
        <p>Nông sản tươi sống được đóng gói trong:</p>
        <ul>
          <li>Túi sinh học phân hủy</li>
          <li>Hộp giấy/xốp cách nhiệt (nếu cần)</li>
          <li>Túi gel giữ lạnh cho sản phẩm nhạy cảm</li>
        </ul>
        
        <p class="note"><strong>Chuỗi lạnh:</strong> Rau củ quả được vận chuyển trong xe có kiểm soát nhiệt độ để đảm bảo độ tươi.</p>
      `,
      isExpanded: false
    },
    {
      id: 5,
      icon: 'setting',
      iconPath: '/asset/icons/setting_dark.png',
      title: 'Chính sách bảo hành',
      content: `
        <h4>Cam kết chất lượng</h4>
        <p>Mặc dù nông sản tươi sống không có khái niệm "bảo hành" như sản phẩm công nghiệp, VGreen cam kết <strong>chất lượng sản phẩm</strong> trong thời gian sau:</p>
        
        <ul>
          <li><strong>Rau xanh, rau ăn lá:</strong> 24-48 giờ (bảo quản trong ngăn mát tủ lạnh)</li>
          <li><strong>Củ quả:</strong> 3-7 ngày (tùy loại, bảo quản đúng cách)</li>
          <li><strong>Trái cây:</strong> 3-10 ngày (tùy độ chín)</li>
        </ul>
        
        <h4>Điều kiện áp dụng cam kết</h4>
        <ol>
          <li>Sản phẩm được bảo quản theo hướng dẫn trên bao bì</li>
          <li>Chưa qua chế biến hoặc làm thay đổi hình dạng ban đầu</li>
          <li>Phát hiện vấn đề trong khung thời gian cam kết</li>
        </ol>
        
        <h4>Quy trình khiếu nại chất lượng</h4>
        <ol>
          <li>Chụp ảnh/quay video rõ nét sản phẩm bị lỗi</li>
          <li>Liên hệ ngay hotline <strong>0123 456 789</strong> hoặc email <strong>vgreenhotro@gmail.com</strong> trong vòng <strong>24 giờ</strong></li>
          <li>Bộ phận CSKH xác nhận và xử lý trong vòng <strong>2 giờ làm việc</strong></li>
          <li>Nhận sản phẩm thay thế hoặc hoàn tiền 100%</li>
        </ol>
        
        <h4>Hướng dẫn bảo quản</h4>
        <div class="storage-guide">
          <div class="guide-item">
            <strong>Rau xanh:</strong>
            <p>Rửa sạch, để ráo nước, bọc giấy thấm, cho vào túi nilon và bảo quản trong ngăn mát tủ lạnh (4-8°C).</p>
          </div>
          <div class="guide-item">
            <strong>Củ quả:</strong>
            <p>Bảo quản nơi khô ráo, thoáng mát. Một số loại như khoai tây, hành, tỏi không cần để tủ lạnh.</p>
          </div>
          <div class="guide-item">
            <strong>Trái cây:</strong>
            <p>Để nơi thoáng mát hoặc ngăn mát tủ lạnh. Không để cùng với trái cây dễ chín (chuối, táo) để tránh nhanh hỏng.</p>
          </div>
        </div>
        
        <p class="highlight"><strong>Cam kết 100%:</strong> Nếu sản phẩm không đạt chất lượng cam kết, chúng tôi hoàn tiền hoặc đổi sản phẩm mới ngay lập tức!</p>
      `,
      isExpanded: false
    }
  ];

  constructor(private route: ActivatedRoute) { }

  ngOnInit(): void {
 // Scroll to top khi component load 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
 // Đọc query parameter để mở chính sách tương ứng 
    this.route.queryParams.subscribe(params => {
      const openPolicy = params['open'];
      if (openPolicy) {
        this.openSpecificPolicy(openPolicy);
      }
    });
  }

 // Mở chính sách cụ thể dựa trên query parameter 
  openSpecificPolicy(policyType: string): void {
    const policyMap: { [key: string]: number } = {
      'return': 1,      // Chính sách đổi trả
      'security': 3,     // Chính sách bảo mật  
      'payment': 2,   // Chính sách thanh toán
      'shipping': 4,    // Chính sách giao hàng
      'warranty': 5     // Chính sách bảo hành
    };

    const policyId = policyMap[policyType];
    if (policyId) {
 // Đóng tất cả chính sách khác trước 
      this.policies.forEach(p => p.isExpanded = false);
      
 // Mở chính sách được chọn 
      const policy = this.policies.find(p => p.id === policyId);
      if (policy) {
        policy.isExpanded = true;
 console.log('Opened policy:', policy.title); 
      }
    }
  }

 // Toggle accordion 
  toggleAccordion(policyId: number): void {
    const policy = this.policies.find(p => p.id === policyId);
    if (policy) {
 console.log('Before toggle:', policy.title, 'isExpanded:', policy.isExpanded); 
      
 // Option 1: Only one can be open at a time (uncomment if needed) 
 // this.policies.forEach(p => { 
 // if (p.id !== policyId) p.isExpanded = false; 
 // }); 
      
 // Option 2: Multiple can be open 
      policy.isExpanded = !policy.isExpanded;
      
 console.log('After toggle:', policy.title, 'isExpanded:', policy.isExpanded); 
      
 // Force change detection 
      setTimeout(() => {
 console.log('Final state:', policy.title, 'isExpanded:', policy.isExpanded); 
      }, 100);
    } else {
 console.error('Policy not found with id:', policyId); 
    }
  }
}
