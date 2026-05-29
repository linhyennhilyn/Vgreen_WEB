import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
 // Danh sách toast đang hiển thị để tính toán vị trí 
  private activeToasts: HTMLElement[] = [];

 // Hiển thị toast notification 
  show(
    message: string,
    type: 'success' | 'error' = 'success',
    zIndex?: number,
    duration: number = 1500
  ): void {
 // Kiểm tra vị trí scroll: nếu ở đầu trang (< 10px) thì tính cả header-top + header-main 
 // Nếu scroll xuống (> 10px) thì chỉ tính header-main 
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    const isAtTop = scrollTop < 10;

    const headerTop = document.querySelector('.header-top') as HTMLElement;
    const headerMain = document.querySelector('.header-main') as HTMLElement;

    let headerHeight = 0;

 // Nếu ở đầu trang: tính cả header-top (nếu có) và header-main 
    if (isAtTop) {
      if (headerTop) {
        headerHeight += headerTop.offsetHeight;
      }
      if (headerMain) {
        headerHeight += headerMain.offsetHeight;
      }
    } else {
 // Khi scroll xuống: chỉ tính header-main 
      if (headerMain) {
        headerHeight = headerMain.offsetHeight;
      }
    }

 // Thêm khoảng cách 20px dưới header 
 // Nếu không tìm thấy header, mặc định 20px từ top 
    const baseTopPosition = headerHeight > 0 ? headerHeight + 20 : 20;

 // Tính toán vị trí top dựa trên số lượng toast đang hiển thị 
 // Mỗi toast có chiều cao khoảng 50px + khoảng cách 10px = 55px 
    const toastSpacing = 55;
    const topPosition = baseTopPosition + this.activeToasts.length * toastSpacing;

 // Create toast element 
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;

 // Xác định màu sắc dựa trên type 
    const backgroundColor = type === 'error' ? '#e74c3c' : '#52A447';
    const boxShadowColor = type === 'error' ? 'rgba(231, 76, 60, 0.3)' : 'rgba(82, 164, 71, 0.3)';

 // Sử dụng z-index được truyền vào, mặc định là 99999 
    const toastZIndex = zIndex || 99999;

 // Add styles 
    toast.style.cssText = `
      position: fixed;
      top: ${topPosition}px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: ${toastZIndex};
      box-shadow: 0 4px 12px ${boxShadowColor};
      transform: translateX(100%);
      transition: transform 0.3s ease, top 0.3s ease;
      min-height: 44px;
    `;

 // Thêm toast vào danh sách đang active 
    this.activeToasts.push(toast);

 // Add to DOM 
    document.body.appendChild(toast);

 // Animate in 
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);

 // Remove after specified duration (default 3 seconds) 
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
 // Xóa toast khỏi danh sách active 
        const index = this.activeToasts.indexOf(toast);
        if (index > -1) {
          this.activeToasts.splice(index, 1);
        }
 // Cập nhật lại vị trí của tất cả các toast còn lại 
        this.updateToastPositions();
      }, 300);
    }, duration);
  }

 // Cập nhật lại vị trí của tất cả toast đang hiển thị 
  private updateToastPositions(): void {
 // Tính lại header height (có thể thay đổi khi scroll) 
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    const isAtTop = scrollTop < 10;

    const headerTop = document.querySelector('.header-top') as HTMLElement;
    const headerMain = document.querySelector('.header-main') as HTMLElement;

    let headerHeight = 0;

    if (isAtTop) {
      if (headerTop) {
        headerHeight += headerTop.offsetHeight;
      }
      if (headerMain) {
        headerHeight += headerMain.offsetHeight;
      }
    } else {
      if (headerMain) {
        headerHeight = headerMain.offsetHeight;
      }
    }

    const baseTopPosition = headerHeight > 0 ? headerHeight + 20 : 20;
    const toastSpacing = 55;

 // Cập nhật vị trí cho từng toast dựa trên index mới của nó 
    this.activeToasts.forEach((toast, index) => {
      const newTopPosition = baseTopPosition + index * toastSpacing;
      toast.style.top = `${newTopPosition}px`;
    });
  }
}
