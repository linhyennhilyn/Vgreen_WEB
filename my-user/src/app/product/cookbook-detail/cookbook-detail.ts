import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-cookbook-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cookbook-detail.html',
  styleUrl: './cookbook-detail.css',
})
export class CookbookDetail implements OnChanges {
  @Input() recipe: any = null; // Recipe data từ parent component
  @Input() isOpen: boolean = false; // Trạng thái hiển thị popup
  @Output() closePopup = new EventEmitter<void>(); // Event đóng popup

  private scrollPosition: number = 0; // Lưu vị trí scroll
  isVideoPlaying: boolean = false; // Trạng thái phát video
  safeVideoUrl: SafeResourceUrl | null = null; // Safe URL để bind trong template

  constructor(private sanitizer: DomSanitizer) {}

  // Lifecycle hook: Theo dõi thay đổi isOpen để khóa/mở scroll
  ngOnChanges(changes: SimpleChanges): void {
    // Nếu recipe thay đổi, cập nhật safe video URL và reset tab về Mô Tả
    if (changes['recipe']) {
      this.updateSafeVideoUrl();
      // Reset tab về "Mô Tả" khi chuyển sang món mới
      this.activeTab = 'description';
      // Scroll về đầu content section
      setTimeout(() => {
        this.scrollToTopOfContent();
      }, 100);

      // Nếu popup đang mở và recipe có video, tự động phát
      if (this.isOpen && this.recipe?.Video && this.safeVideoUrl) {
        setTimeout(() => {
          this.isVideoPlaying = true;
        }, 150);
      } else if (!this.isOpen) {
        // Reset video state khi recipe thay đổi (nếu popup đóng)
        this.isVideoPlaying = false;
      }
    }

    if (changes['isOpen']) {
      if (this.isOpen) {
        // Popup mở: Lưu vị trí scroll hiện tại và khóa body scroll
        this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = this.getScrollbarWidth() + 'px'; // Tránh jump khi scrollbar biến mất

        // Chặn sự kiện scroll và touch
        document.addEventListener('wheel', this.preventScroll, { passive: false });
        document.addEventListener('touchmove', this.preventScroll, { passive: false });

        // Reset tab về "Mô Tả" khi popup mở
        this.activeTab = 'description';

        // Đảm bảo video URL được set khi popup mở
        this.updateSafeVideoUrl();

        // Scroll về đầu content section sau khi DOM render
        setTimeout(() => {
          this.scrollToTopOfContent();
        }, 100);

        // Tự động phát video khi popup mở (nếu có video)
        // Delay nhỏ để đảm bảo DOM đã render và video URL đã sẵn sàng
        setTimeout(() => {
          if (this.recipe?.Video && this.safeVideoUrl) {
            this.isVideoPlaying = true;
          }
        }, 150);
      } else {
        // Popup đóng: Khôi phục body scroll và vị trí scroll
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, this.scrollPosition);

        // Xóa event listeners
        document.removeEventListener('wheel', this.preventScroll);
        document.removeEventListener('touchmove', this.preventScroll);

        // Reset video playback khi đóng popup
        this.isVideoPlaying = false;
        this.safeVideoUrl = null;
        // Reset tab về "Mô Tả" khi đóng popup
        this.activeTab = 'description';
      }
    }
  }

  // Scroll về đầu content section
  private scrollToTopOfContent(): void {
    const contentSection = document.querySelector('.content-section');
    if (contentSection) {
      contentSection.scrollTo({
        top: 0,
        behavior: 'instant', // Dùng 'instant' để không có animation, hoặc 'smooth' nếu muốn có animation
      });
    }
  }

  // Cập nhật safe video URL (chỉ khi cần thiết)
  private updateSafeVideoUrl(): void {
    if (this.recipe?.Video) {
      this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.recipe.Video);
    } else {
      this.safeVideoUrl = null;
    }
  }

  // Prevent scroll event - Ngăn scroll chaining
  private preventScroll = (e: Event): void => {
    const target = e.target as HTMLElement;
    const contentSection = target.closest('.content-section');

    // Nếu không phải từ content section (tức là từ overlay/popup container), ngăn scroll
    if (!contentSection) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Nếu từ content section, kiểm tra scroll chaining
    const element = contentSection as HTMLElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // Kiểm tra scroll direction
    const delta = (e as WheelEvent).deltaY;

    // Nếu scroll xuống và đã ở cuối ngăn scroll
    if (delta > 0 && scrollTop + clientHeight >= scrollHeight) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Nếu scroll lên và đã ở đầu ngăn scroll
    if (delta < 0 && scrollTop <= 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Cho phép scroll bình thường trong content section
  };

  // Tính width của scrollbar để tránh content jump
  private getScrollbarWidth(): number {
    return window.innerWidth - document.documentElement.clientWidth;
  }

  // Active tab (mặc định là 'description')
  activeTab: string = 'description';

  // Danh sách tabs
  tabs = [
    { id: 'description', label: 'Mô Tả' },
    { id: 'ingredients', label: 'Nguyên Liệu' },
    { id: 'instructions', label: 'Thực Hiện' },
    { id: 'usage', label: 'Cách Dùng' },
  ];

  // Đóng popup
  close(): void {
    this.closePopup.emit();
  }

  // Đóng popup khi click overlay
  closeOnOverlay(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-overlay')) {
      this.close();
    }
  }

  // Scroll đến section khi click tab
  setActiveTab(tabId: string): void {
    this.activeTab = tabId;

    // Scroll đến section tương ứng
    const sectionId = `section-${tabId}`;
    const section = document.getElementById(sectionId);

    if (section) {
      // Scroll smooth đến section
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }
  }

  // Parse ingredients từ string thành array
  getIngredientsList(): string[] {
    // Ưu tiên Ingredients từ dishes.json (có dấu ; và dấu ,)
    const ingredientsText = this.recipe?.Ingredients || this.recipe?.Ingredient || '';
    if (!ingredientsText) return [];

    // Split theo dấu ; hoặc dấu , và trim
    return ingredientsText
      .split(/[;,]/)
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
  }

  // Parse instructions thành steps
  getInstructionSteps(): string[] {
    // Lấy từ Cooking trong dishes.json
    const instructionText = this.recipe?.Cooking || this.recipe?.Instruction || '';
    if (!instructionText) return [];

    // Split theo dấu chấm và filter các dòng không rỗng
    return instructionText
      .split(/\.\s+/)
      .map((step: string) => step.trim())
      .filter((step: string) => step.length > 0);
  }

  // Extract YouTube video ID từ URL
  getYouTubeVideoId(url: string): string {
    if (!url) return '';

    // URL format: https://www.youtube.com/embed/XssKM6yLekE?rel=0&showinfo=0&autoplay=1&enablejsapi=1
    const regex = /(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
  }

  // Lấy YouTube thumbnail URL
  getYouTubeThumbnail(url: string): string {
    const videoId = this.getYouTubeVideoId(url);
    if (!videoId) return this.recipe?.Image || '';

    // Sử dụng maxresdefault cho chất lượng cao nhất
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Phát video khi nhấn nút play
  playVideo(): void {
    // Đảm bảo video URL được set trước khi play
    if (!this.safeVideoUrl && this.recipe?.Video) {
      this.updateSafeVideoUrl();
    }
    this.isVideoPlaying = true;
  }

  // Format Usage text - Loại bỏ "Cách dùng:" nếu có ở đầu
  getFormattedUsage(): string {
    if (!this.recipe?.Usage) return 'Chưa có thông tin cách dùng.';

    let usageText = this.recipe.Usage;

    // Loại bỏ "Cách dùng:" hoặc "Cách Dùng:" ở đầu (case-insensitive)
    usageText = usageText.replace(/^Cách\s+[Dd]ùng\s*:\s*/i, '');

    return usageText.trim() || 'Chưa có thông tin cách dùng.';
  }
}
