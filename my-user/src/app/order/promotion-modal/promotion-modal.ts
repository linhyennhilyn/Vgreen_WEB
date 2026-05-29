import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ScrollLockService } from '../../services/scroll-lock.service';

export interface Promotion {
  id: string;
  code: string; // Mã khuyến mãi (VD: FREESHIP, SALE50)
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  expiryDate: string;
  expiryLabel: string;
  expiryValue: string;
  isActive: boolean;
  promotionType?: string; // Thêm field để phân biệt Shipping vs Product promotions
}

export interface PromotionJson {
  promotion_id: string;
  code: string;
  name: string;
  description: string;
  type: string;
  scope: string;
  discount_type: string;
  discount_value: number;
  max_discount_value: number;
  min_order_value: number;
  usage_limit: number;
  user_limit: number;
  is_first_order_only: boolean;
  start_date: string;
  end_date: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PromotionResult {
  selectedPromotion: Promotion | null;
  discountAmount: number;
  finalAmount: number;
}

@Component({
  selector: 'app-promotion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-modal.html',
  styleUrl: './promotion-modal.css',
})
export class PromotionModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() cartAmount: number = 0;
  @Input() availablePromotions: Promotion[] = [];
  @Input() currentSelectedPromotion: Promotion | null = null;
  @Output() promotionApplied = new EventEmitter<PromotionResult>();
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirmPromotion = new EventEmitter<void>();

  selectedPromotionId: string = '';
  manualPromoCode: string = '';
  isApplying = false;
  errorMessage = '';
  rawPromotionsData: PromotionJson[] = [];
  isValidCode = false;
  isCodeValidated = false;
  hasError = false;
  isLoading: boolean = false;
  validatedPromotion: Promotion | null = null; // Lưu promotion đã validate từ mã thủ công

  get hasValidPromotion(): boolean {
    return this.selectedPromotionId !== '' || this.isCodeValidated;
  }

  // Nút "Tìm kiếm" - chỉ cần đủ 4 ký tự
  get canSearchCode(): boolean {
    return this.manualPromoCode.trim().length >= 4 && !this.hasError;
  }

  // Nút "Áp dụng" - chỉ kích hoạt khi có promotion được chọn
  get canApplyPromotion(): boolean {
    return this.hasValidPromotion;
  }

  constructor(private http: HttpClient, private scrollLock: ScrollLockService) {}

  ngOnInit() {
    console.log('🔄 [Promotions] Modal initialized with cartAmount:', this.cartAmount);
    this.loadPromotions();

    // Khôi phục trạng thái đã chọn
    if (this.currentSelectedPromotion) {
      this.selectedPromotionId = this.currentSelectedPromotion.id;
      this.manualPromoCode = '';
    }

    // Lock scroll khi modal mở
    this.scrollLock.lock();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cartAmount']) {
      console.log('🔄 [Promotions] cartAmount changed:', {
        previousValue: changes['cartAmount'].previousValue,
        currentValue: changes['cartAmount'].currentValue,
      });
    }
  }

  ngOnDestroy() {
    // Unlock scroll khi modal đóng
    this.scrollLock.unlock();
  }

  loadPromotions() {
    console.log('🔄 [Promotions] Loading promotions from API...');
    this.isLoading = true;

    // Gọi API MongoDB để lấy promotions đang diễn ra
    this.http
      .get<{ success: boolean; data: PromotionJson[]; count: number }>(
        'http://localhost:3000/api/promotions/active'
      )
      .subscribe({
        next: (response) => {
          // console.log('✅ [Promotions] ==========================================');
          // console.log('✅ [Promotions] API Response received:', {
          //   success: response.success,
          //   count: response.count,
          //   dataLength: response.data?.length || 0,
          // });

          if (response.data && response.data.length > 0) {
            console.log(
              `📋 [Promotions] All promotion codes from API:`,
              response.data.map((p: PromotionJson) => ({
                code: p.code,
                name: p.name,
                status: p.status,
                type: p.type,
                end_date: p.end_date,
                min_order_value: p.min_order_value,
              }))
            );
          }
          // console.log('✅ [Promotions] ==========================================');

          this.isLoading = false;

          if (!response.success) {
            console.warn('⚠️ [Promotions] API returned success: false');
            this.rawPromotionsData = [];
            this.availablePromotions = [];
            return;
          }

          if (!response.data || response.data.length === 0) {
            console.warn('⚠️ [Promotions] No promotions found in response');
            this.rawPromotionsData = [];
            this.availablePromotions = [];
            return;
          }

          this.rawPromotionsData = response.data;
          console.log(
            `📋 [Promotions] Raw promotions data: ${this.rawPromotionsData.length} items`
          );

          this.availablePromotions = this.filterAndTransformPromotions(response.data);
          console.log(
            `✅ [Promotions] Final result: ${this.availablePromotions.length} available promotions`
          );
          console.log(
            '📊 [Promotions] Available promotions details:',
            this.availablePromotions.map((p) => ({
              code: p.code,
              name: p.name,
              minOrder: p.minOrderAmount,
              cartAmount: this.cartAmount,
              canUse: this.canUsePromotion(p),
            }))
          );
        },
        error: (error) => {
          console.error('❌ [Promotions] Error loading from MongoDB:', error);
          console.error('❌ [Promotions] Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error,
          });
          this.isLoading = false;
          this.rawPromotionsData = [];
          this.availablePromotions = [];
        },
      });
  }

  trackByPromotionId(index: number, promotion: Promotion): string {
    return promotion.id;
  }

  private filterAndTransformPromotions(jsonData: PromotionJson[]): Promotion[] {
    console.log('🔄 [Promotions] ==========================================');
    console.log('🔄 [Promotions] Transforming promotions from MongoDB:', jsonData.length);

    if (!jsonData || jsonData.length === 0) {
      console.warn('⚠️ [Promotions] No data to transform');
      return [];
    }

    // Lọc chỉ lấy promotions có scope là "Shipping" hoặc "Order"
    const filteredData = jsonData.filter((promo) => {
      const isValidScope = promo.scope === 'Shipping' || promo.scope === 'Order';
      if (!isValidScope) {
        console.log(
          `⏭️ [Promotions] Skipping promotion ${promo.code} - scope: ${promo.scope} (not Shipping/Order)`
        );
      }
      return isValidScope;
    });

    console.log(
      `📋 [Promotions] Processing ${filteredData.length}/${jsonData.length} promotions (filtered by scope: Shipping/Order)`
    );
    console.log(
      `📋 [Promotions] All promotion codes from API:`,
      jsonData.map((p) => p.code)
    );
    console.log(
      `📋 [Promotions] Filtered promotion codes:`,
      filteredData.map((p) => p.code)
    );

    const promotions: Promotion[] = [];
    const errors: Array<{ code: string; error: any }> = [];

    filteredData.forEach((promo, index) => {
      console.log(`📝 [Promotions] Processing ${index + 1}/${filteredData.length}:`, {
        id: promo.promotion_id,
        code: promo.code,
        name: promo.name,
        status: promo.status,
        type: promo.type,
        scope: promo.scope,
        endDate: promo.end_date,
        startDate: promo.start_date,
        usage_limit: promo.usage_limit,
        min_order_value: promo.min_order_value,
      });

      try {
        const transformed = this.transformPromotion(promo);
        promotions.push(transformed);
        console.log(`✅ [Promotions] Successfully transformed: ${transformed.code}`);
      } catch (error) {
        console.error(`❌ [Promotions] Error transforming ${promo.code}:`, error);
        errors.push({ code: promo.code, error });
      }
    });

    console.log(
      `✅ [Promotions] Transformed ${promotions.length}/${jsonData.length} promotions successfully`
    );
    if (errors.length > 0) {
      console.warn(`⚠️ [Promotions] ${errors.length} promotions failed to transform:`, errors);
    }
    console.log('🔄 [Promotions] ==========================================');

    // Sắp xếp: mã có thể sử dụng lên đầu, mã chưa đủ điều kiện xuống dưới
    // Trong mỗi nhóm, sắp xếp theo thời gian hết hạn (gần hết hạn lên đầu)
    const sorted = promotions.sort((a, b) => {
      const aCanUse = this.canUsePromotion(a);
      const bCanUse = this.canUsePromotion(b);

      // Nếu một mã có thể dùng và một mã không thể dùng
      if (aCanUse && !bCanUse) return -1; // a lên đầu
      if (!aCanUse && bCanUse) return 1; // b lên đầu

      // Nếu cả hai đều có thể dùng hoặc không thể dùng, sắp xếp theo thời gian hết hạn
      const aExpiry = new Date(a.expiryDate);
      const bExpiry = new Date(b.expiryDate);
      return aExpiry.getTime() - bExpiry.getTime(); // Gần hết hạn lên đầu
    });

    console.log(`📊 [Promotions] Final sorted list: ${sorted.length} promotions`);
    console.log(`   - Applicable: ${sorted.filter((p) => this.canUsePromotion(p)).length}`);
    console.log(`   - Not applicable: ${sorted.filter((p) => !this.canUsePromotion(p)).length}`);

    return sorted;
  }

  private canUsePromotion(promotion: Promotion): boolean {
    // Kiểm tra xem mã có thể sử dụng được không
    const canUse = this.cartAmount >= promotion.minOrderAmount;

    // Log để debug
    if (!canUse) {
      console.log(`⚠️ [Promotions] Promotion ${promotion.code} không đủ điều kiện:`, {
        cartAmount: this.cartAmount,
        minOrderAmount: promotion.minOrderAmount,
        difference: promotion.minOrderAmount - this.cartAmount,
      });
    }

    return canUse;
  }

  private transformPromotion(jsonPromo: PromotionJson): Promotion {
    try {
      const discountValue = jsonPromo.discount_value || 0;
      const minOrderAmount = jsonPromo.min_order_value || 0;
      const endDate = new Date(jsonPromo.end_date);
      const currentDate = new Date();
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let expiryLabel: string;
      let expiryValue: string;
      if (daysUntilExpiry <= 3) {
        expiryLabel = 'Hết hạn trong:';
        expiryValue = `${daysUntilExpiry} ngày`;
      } else {
        expiryLabel = 'HSD:';
        expiryValue = this.formatDate(jsonPromo.end_date);
      }

      const transformed: Promotion = {
        id: jsonPromo.promotion_id || '',
        code: jsonPromo.code || '', // Map mã khuyến mãi
        name: jsonPromo.name || '',
        description: jsonPromo.description || '',
        discountType: this.getDiscountType(jsonPromo.discount_type),
        discountValue: discountValue,
        minOrderAmount: minOrderAmount,
        maxDiscount: jsonPromo.max_discount_value > 0 ? jsonPromo.max_discount_value : undefined,
        expiryDate: jsonPromo.end_date, // Lưu format ISO (YYYY-MM-DD) để sort đúng
        expiryLabel: expiryLabel,
        expiryValue: expiryValue,
        // Hỗ trợ cả status "Active" và "đang diễn ra"
        isActive: jsonPromo.status === 'Active' || jsonPromo.status === 'đang diễn ra',
        promotionType: jsonPromo.scope, // Dùng 'scope' để phân biệt Order/Shipping/Category/Product
      };

      console.log(
        `✅ [Promotions] Transformed: ${transformed.code} - ${transformed.name} (status: ${jsonPromo.status})`
      );
      return transformed;
    } catch (error) {
      console.error(
        `❌ [Promotions] Error transforming promotion ${jsonPromo.promotion_id}:`,
        error
      );
      // Return a default promotion to prevent breaking the UI
      return {
        id: jsonPromo.promotion_id || '',
        code: jsonPromo.code || '',
        name: jsonPromo.name || 'Unknown',
        description: jsonPromo.description || '',
        discountType: 'fixed',
        discountValue: 0,
        minOrderAmount: 0,
        expiryDate: jsonPromo.end_date || new Date().toISOString(),
        expiryLabel: 'HSD:',
        expiryValue: this.formatDate(jsonPromo.end_date || new Date().toISOString()),
        isActive: false,
        promotionType: jsonPromo.scope || 'Order',
      };
    }
  }

  private getDiscountType(promoType: string): 'percentage' | 'fixed' {
    switch (promoType) {
      case 'percent':
        return 'percentage';
      case 'fixed':
        return 'fixed';
      case 'buy1get1':
        return 'fixed'; // Treat buy1get1 as fixed for now
      default:
        return 'fixed';
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  }

  onPromotionSelect(promotionId: string) {
    this.selectedPromotionId = promotionId;
    this.errorMessage = '';
    this.isValidCode = false;
    this.isCodeValidated = false;
    this.validatedPromotion = null; // Reset validated promotion khi chọn từ danh sách
  }

  onManualCodeChange() {
    this.errorMessage = '';
    this.hasError = false;
    const trimmedCode = this.manualPromoCode.trim();
    this.isValidCode = trimmedCode.length >= 4;
    this.isCodeValidated = false;
    this.validatedPromotion = null; // Reset khi thay đổi mã

    console.log('Manual code change:', {
      original: this.manualPromoCode,
      trimmed: trimmedCode,
      length: trimmedCode.length,
      isValidCode: this.isValidCode,
      canSearchCode: this.canSearchCode,
      canApplyPromotion: this.canApplyPromotion,
      isCodeValidated: this.isCodeValidated,
    });

    if (trimmedCode.length > 0) {
      this.selectedPromotionId = '';
    }
  }

  onCompositionEnd() {
    this.errorMessage = '';
    this.hasError = false;
    const trimmedCode = this.manualPromoCode.trim();
    this.isValidCode = trimmedCode.length >= 4;
    this.isCodeValidated = false;
    this.validatedPromotion = null; // Reset khi thay đổi mã

    console.log('Composition end:', {
      original: this.manualPromoCode,
      trimmed: trimmedCode,
      length: trimmedCode.length,
      isValidCode: this.isValidCode,
      canSearchCode: this.canSearchCode,
      canApplyPromotion: this.canApplyPromotion,
      isCodeValidated: this.isCodeValidated,
    });

    if (trimmedCode.length > 0) {
      this.selectedPromotionId = '';
    }
  }

  onClearCode(inputElement: HTMLInputElement) {
    this.manualPromoCode = '';
    this.errorMessage = '';
    this.isValidCode = false;
    this.isCodeValidated = false;
    this.validatedPromotion = null; // Reset validated promotion khi xóa mã
    inputElement.focus();
  }

  // Hàm này chỉ dùng cho nút "Tìm kiếm"
  async onSearchPromotion() {
    if (!this.manualPromoCode.trim()) {
      this.errorMessage = 'Vui lòng nhập mã khuyến mãi';
      return;
    }

    this.errorMessage = '';

    try {
      const selectedPromotion = await this.validateManualCode(this.manualPromoCode.trim());

      if (!selectedPromotion) {
        this.errorMessage = 'Mã khuyến mãi không hợp lệ';
        this.hasError = true;
        return;
      }

      // Check if promotion is applicable
      if (this.cartAmount < selectedPromotion.minOrderAmount) {
        this.errorMessage = `Đơn hàng tối thiểu ${selectedPromotion.minOrderAmount.toLocaleString(
          'vi-VN'
        )}₫ để áp dụng khuyến mãi này`;
        this.hasError = true;
        return;
      }

      // Calculate discount
      const discountAmount = this.calculateDiscount(selectedPromotion);
      const finalAmount = this.cartAmount - discountAmount;

      // Mark code as validated successfully
      this.isCodeValidated = true;
      this.selectedPromotionId = selectedPromotion.id;
      this.validatedPromotion = selectedPromotion; // Lưu promotion đã validate

      // KHÔNG emit result ở đây - chỉ khi nhấn "Áp dụng"
      // this.promotionApplied.emit({
      // selectedPromotion,
      // discountAmount,
      // finalAmount,
      // });

      this.errorMessage = '';
      console.log('Mã khuyến mãi tìm thấy:', selectedPromotion.name);
    } catch (error) {
      this.errorMessage = 'Có lỗi xảy ra khi tìm kiếm khuyến mãi';
      this.hasError = true;
    }
  }

  // Hàm này chỉ dùng cho nút "Áp dụng" - chỉ xác nhận và đóng modal
  async onApplyPromotion() {
    if (!this.hasValidPromotion) {
      this.errorMessage = 'Vui lòng chọn hoặc tìm kiếm mã khuyến mãi trước';
      return;
    }

    let selectedPromotion: Promotion | null = null;

    if (this.selectedPromotionId) {
      selectedPromotion =
        this.availablePromotions.find((p) => p.id === this.selectedPromotionId) || null;
    }

    if (!selectedPromotion) {
      this.errorMessage = 'Không tìm thấy khuyến mãi đã chọn';
      return;
    }

    // Calculate discount
    const discountAmount = this.calculateDiscount(selectedPromotion);
    const finalAmount = this.cartAmount - discountAmount;

    // Emit final result
    this.promotionApplied.emit({
      selectedPromotion,
      discountAmount,
      finalAmount,
    });

    // Close modal
    this.closeModal.emit();
  }

  async onConfirmPromotion() {
    this.confirmPromotion.emit();
  }

  private async validateManualCode(code: string): Promise<Promotion | null> {
    try {
      // Gọi API để tìm promotion theo code
      const response = await this.http
        .get<{ success: boolean; data: PromotionJson }>(
          `http://localhost:3000/api/promotions/code/${code}`
        )
        .toPromise();

      if (response && response.success && response.data) {
        // Kiểm tra scope - chỉ chấp nhận Shipping hoặc Order
        if (response.data.scope !== 'Shipping' && response.data.scope !== 'Order') {
          console.log(
            `⏭️ [Promotions] Code ${code} has scope ${response.data.scope} - not applicable (only Shipping/Order allowed)`
          );
          return null;
        }

        console.log(' [Promotions] Found code in MongoDB:', response.data.code);
        return this.transformPromotion(response.data);
      }

      console.log(' [Promotions] Code not found in MongoDB:', code);
      return null;
    } catch (error) {
      console.error(' [Promotions] Error validating code:', error);
      return null;
    }
  }

  private calculateDiscount(promotion: Promotion): number {
    // Kiểm tra điều kiện tối thiểu trước khi tính discount
    if (this.cartAmount < promotion.minOrderAmount) {
      return 0;
    }

    // Kiểm tra nếu là Shipping promotion - không trừ vào total amount
    if (this.isShippingPromotion(promotion)) {
      return 0; // Shipping promotions không ảnh hưởng đến giá sản phẩm
    }

    let discount = 0;

    if (promotion.discountType === 'percentage') {
      discount = (this.cartAmount * promotion.discountValue) / 100;
      if (promotion.maxDiscount && discount > promotion.maxDiscount) {
        discount = promotion.maxDiscount;
      }
    } else {
      discount = promotion.discountValue;
    }

    return Math.min(discount, this.cartAmount);
  }

  // Kiểm tra nếu là Shipping promotion
  private isShippingPromotion(promotion: Promotion): boolean {
    return promotion.promotionType === 'Shipping'; // promotionType đã được map từ 'scope'
  }

  onRemovePromotion() {
    this.selectedPromotionId = '';
    this.manualPromoCode = '';
    this.validatedPromotion = null;
    this.isCodeValidated = false;
    this.promotionApplied.emit({
      selectedPromotion: null,
      discountAmount: 0,
      finalAmount: this.cartAmount,
    });
  }

  onRemoveAllPromotions() {
    this.selectedPromotionId = '';
    this.manualPromoCode = '';
    this.validatedPromotion = null;
    this.isCodeValidated = false;
    this.promotionApplied.emit({
      selectedPromotion: null,
      discountAmount: 0,
      finalAmount: this.cartAmount,
    });
    this.closeModal.emit();
  }

  onClose() {
    this.closeModal.emit();
  }

  isPromotionApplicable(promotion: Promotion): boolean {
    const isApplicable = this.cartAmount >= promotion.minOrderAmount;

    // Log để debug nếu không đủ điều kiện
    if (!isApplicable) {
      console.log(`⚠️ [Promotions] Promotion ${promotion.code} không đủ điều kiện (UI check):`, {
        cartAmount: this.cartAmount,
        minOrderAmount: promotion.minOrderAmount,
        difference: promotion.minOrderAmount - this.cartAmount,
      });
    }

    return isApplicable;
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + '₫';
  }

  getSelectedPromotionName(): string {
    const promotion = this.getSelectedPromotion();
    if (promotion) {
      return promotion.name;
    } else if (this.manualPromoCode.trim()) {
      return 'Mã: ' + this.manualPromoCode;
    }
    return '';
  }

  getSelectedPromotion(): Promotion | null {
    if (this.selectedPromotionId) {
      return this.availablePromotions.find((p) => p.id === this.selectedPromotionId) || null;
    } else if (this.validatedPromotion) {
      // Nếu có promotion đã validate từ mã thủ công
      return this.validatedPromotion;
    }
    return null;
  }

  getSelectedPromotionDiscount(): string {
    const promotion = this.getSelectedPromotion();
    if (!promotion) {
      return '';
    }

    // Tính số tiền giảm
    const discountAmount = this.calculateDiscount(promotion);

    // Nếu là Shipping promotion, hiển thị "Miễn phí vận chuyển"
    if (this.isShippingPromotion(promotion)) {
      return 'Miễn phí vận chuyển';
    }

    // Format số tiền giảm
    return 'Giảm ' + this.formatCurrency(discountAmount);
  }
}
