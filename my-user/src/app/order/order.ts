import { Component, OnInit, AfterViewInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { AddressFormComponent, AddressInfo as FormAddressInfo } from './address-form/address-form';
import {
  PaymentMethodComponent,
  PaymentInfo,
  PaymentResult,
} from './payment-method/payment-method';
import {
  PromotionModalComponent,
  Promotion,
  PromotionResult,
} from './promotion-modal/promotion-modal';
import { InformationList } from './information-list/information-list';
import { CartService } from '../services/cart.service';
import { AddressService, AddressInfo as ServiceAddressInfo } from '../services/address.service';
import { OrderService, CreateOrderRequest, OrderItem } from '../services/order.service';
import { ToastService } from '../services/toast.service';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
  subcategory: string;
  sku?: string; // Thêm SKU để xóa items sau khi đặt hàng
  unit?: string; // Thêm unit để hiển thị trong order
  hasBuy1Get1?: boolean; // Có khuyến mãi buy1get1 không
  originalPrice?: number; // Giá gốc trước khuyến mãi
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
}

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AddressFormComponent,
    PaymentMethodComponent,
    PromotionModalComponent,
    InformationList,
  ],
  templateUrl: './order.html',
  styleUrl: './order.css',
})
export class OrderComponent implements OnInit, AfterViewInit, OnDestroy {
  // UI States
  showAddressModal = false;
  showPaymentModal = false;
  showPromotionModal = false;
  showAddressListModal = false;
  showOrderSuccessModal = false;
  createdOrderId: string = '';

  // Address management
  addressMode: 'add' | 'edit' = 'add';
  currentEditingIndex = -1;
  addressList: FormAddressInfo[] = [];
  selectedAddressIndex = 0;

  // Delivery addresses (fixed list)
  deliveryAddresses = [
    '20 Đường Lê Lợi, phường Cái Khế, Quận Ninh Kiều, TP. Cần Thơ',
    '1 Đ. Lê Đức Thọ, Mỹ Đình, Nam Từ Liêm, Hà Nội',
    '15 Lạch Tray, Lê Lợi, Ngô Quyền, Hải Phòng',
    '138 Đ. Đào Duy Từ, Phường 6, Quận 10, Hồ Chí Minh',
    'Số 9 Phố Trịnh Hoài Đức, Phường Cát Linh, Quận Đống Đa, TP. Hà Nội',
    'Góc đường 30/4 và Đại lộ Bình Dương, phường Phú Thọ, thành phố Thủ Dầu Một, tỉnh Bình Dương',
  ];
  selectedDeliveryAddress = '';
  showDeliveryDropdown = false;

  // Order Data
  addressInfo: FormAddressInfo = {
    fullName: '',
    phone: '',
    email: '',
    city: '',
    district: '',
    ward: '',
    detail: '',
    deliveryMethod: 'standard',
  };

  wantInvoice = false;
  invoiceInfo = {
    companyName: '',
    taxId: '',
    invoiceEmail: '',
    invoiceAddress: '',
  };
  invoiceErrors: any = {};

  consultantCode = ''; // Mã nhân viên tư vấn
  isStickyBottom = false; // Trạng thái nút thanh toán: false = fixed, true = sticky

  paymentInfo: PaymentInfo = {
    method: 'cod',
    amount: 0,
    orderId: '',
  };

  selectedPromotion: Promotion | null = null;
  discountAmount = 0;
  finalAmount = 0;

  // Cart items from CartService
  cartItems: CartItem[] = [];

  subtotal = 0; // Tổng tiền hàng (chưa VAT)
  subtotalWithVAT = 0; // Tổng tiền hàng (đã gồm VAT) - dùng để hiển thị
  shippingFee = 30000;
  vatRate = 10;
  vatAmount = 0;
  totalAmount = 0;

  // Subscription
  private addressSubscription: Subscription = new Subscription();
  private routerSubscription: Subscription = new Subscription();

  promotions: any[] = []; // Lưu promotions để check buy1get1
  promotionTargets: any[] = []; // Lưu promotion targets để check buy1get1

  constructor(
    private router: Router,
    private cartService: CartService,
    private addressService: AddressService,
    private orderService: OrderService,
    private http: HttpClient,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    // Force scroll to top ngay lập tức - TRƯỚC TẤT CẢ
    this.forceScrollToTop();

    // Subscribe to router NavigationEnd events để scroll sau khi navigation hoàn tất
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        // Scroll về top sau mỗi lần navigation
        setTimeout(() => {
          this.forceScrollToTop();
        }, 0);
      });

    // Force reload CustomerID từ localStorage trước
    this.addressService.reloadCustomerID();

    // Subscribe to address changes from AddressService
    this.addressSubscription = this.addressService.addresses$.subscribe((addresses) => {
      // console.log('� [Order] Addresses updated from service:', addresses);

      // Convert ServiceAddressInfo to FormAddressInfo (bao gồm isDefault)
      this.addressList = addresses.map((addr) => ({
        fullName: addr.fullName,
        phone: addr.phone,
        email: addr.email,
        city: addr.city,
        district: addr.district,
        ward: addr.ward,
        detail: addr.detail,
        notes: addr.notes,
        deliveryMethod: addr.deliveryMethod,
        isDefault: addr.isDefault,
      }));

      // console.log(' [Order] AddressList length:', this.addressList.length);

      // Auto-select default address or first address
      if (this.addressList.length > 0) {
        // Nếu đang có selectedAddressIndex hợp lệ, giữ nguyên (tránh reset khi subscription update)
        // Chỉ auto-select nếu selectedAddressIndex không hợp lệ hoặc chưa được set
        if (this.selectedAddressIndex < 0 || this.selectedAddressIndex >= this.addressList.length) {
          const defaultAddress = addresses.find((addr) => addr.isDefault);
          if (defaultAddress) {
            const defaultIndex = addresses.indexOf(defaultAddress);
            this.selectedAddressIndex = defaultIndex >= 0 ? defaultIndex : 0;
          } else {
            this.selectedAddressIndex = 0;
          }
        }

        // Set addressInfo - CRITICAL: Always update from addressList
        if (this.addressList[this.selectedAddressIndex]) {
          this.addressInfo = { ...this.addressList[this.selectedAddressIndex] };
          console.log('✅ [Order] Updated addressInfo from subscription:', this.addressInfo);
        }
        // console.log(' [Order] Selected address:', this.addressInfo);
        // console.log(' [Order] Has addresses - NO popup');
      } else {
        this.selectedAddressIndex = -1;
        this.addressInfo = {
          fullName: '',
          phone: '',
          email: '',
          city: '',
          district: '',
          ward: '',
          detail: '',
          deliveryMethod: 'standard',
        };
        console.log('ℹ️ [Order] No addresses available');
      }
    });

    // Đợi 500ms để AddressService load xong data từ backend, rồi check và popup nếu cần
    setTimeout(() => {
      if (this.addressList.length === 0) {
        // console.log(' [Order] Still no addresses after 500ms Show popup');
        this.onOpenAddressModal();
      }
    }, 500);

    // Lấy dữ liệu cart từ CartService
    const allCartItems = this.cartService.getCartItems()();
    let selectedItems = this.cartService.selectedItems();

    // Nếu không có item nào được chọn, sử dụng tất cả items
    // (Khi vào trang order, mặc định chọn tất cả items trong giỏ hàng)
    if (selectedItems.length === 0 && allCartItems.length > 0) {
      console.log('📦 [Order] No items selected, using all cart items');
      selectedItems = allCartItems;
    }

    console.log('📦 [Order] Cart items loaded:', {
      totalItems: allCartItems.length,
      selectedItemsCount: selectedItems.length,
      usingAllItems: selectedItems.length === allCartItems.length && allCartItems.length > 0,
    });

    // Log selectedItems để debug itemType
    console.log(
      '📦 [Order] Selected items from cart:',
      selectedItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
        hasBuy1Get1: item.hasBuy1Get1,
      }))
    );

    // Map items để tạo đơn hàng (items đã có sẵn itemType từ cart)
    this.cartItems = selectedItems.map((item) => {
      // Đảm bảo itemType được giữ nguyên từ cart item
      const itemType = item.itemType || 'purchased';

      console.log(
        `📦 [Order] Mapping item: SKU=${item.sku}, itemType=${item.itemType}, finalItemType=${itemType}`
      );

      return {
        id: item.id,
        name: item.name || item.productName,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        subcategory: item.subcategory,
        sku: item.sku, // Thêm SKU để xóa items sau khi đặt hàng
        unit: item.unit, // Thêm unit để hiển thị trong order
        originalPrice: item.originalPrice, // Giá gốc trước khuyến mãi
        hasBuy1Get1: item.hasBuy1Get1 || false, // Có khuyến mãi buy1get1 không
        itemType: itemType, // Loại item: mua hoặc tặng kèm - giữ nguyên từ cart
      };
    });

    console.log('📦 [Order] Mapped cart items for order:', this.cartItems.length);
    console.log('📦 [Order] Item types:', {
      purchased: this.cartItems.filter((i) => i.itemType === 'purchased').length,
      gifted: this.cartItems.filter((i) => i.itemType === 'gifted').length,
    });
    console.log(
      '📦 [Order] Detailed item types:',
      this.cartItems.map((item) => ({
        sku: item.sku,
        name: item.name,
        itemType: item.itemType,
      }))
    );

    // Lấy thông tin promotion từ CartService
    this.selectedPromotion = this.cartService.getSelectedPromotion()();
    this.discountAmount = this.cartService.getDiscountAmount()();
    this.finalAmount = this.cartService.getFinalAmount()();

    // Set default delivery address
    this.selectedDeliveryAddress = this.deliveryAddresses[0];

    // Calculate totals and set payment amount
    this.calculateTotals();

    // REMOVED: Auto-open popup logic moved to subscribe callback
    // Logic mở popup tự động đã được di chuyển vào subscribe callback
    // để đảm bảo addressList đã được load xong

    // Setup scroll listener for mobile button positioning
    if (window.innerWidth <= 1024) {
      this.setupScrollListener();
    }
  }

  ngAfterViewInit() {
    // Scroll to top ngay sau khi view init
    setTimeout(() => {
      this.forceScrollToTop();
      // Retry sau khi DOM đã render xong
      this.scrollToTopWithRetry(0, 3);
    }, 0);
  }

  /**
   * Force scroll to top - phương pháp mạnh mẽ nhất
   */
  private forceScrollToTop(): void {
    // Method 1: window.scrollTo
    try {
      window.scrollTo(0, 0);
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (e) {
      console.warn('[Order] Error with window.scrollTo:', e);
    }

    // Method 2: document.documentElement.scrollTop
    try {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    } catch (e) {
      console.warn('[Order] Error with documentElement.scrollTop:', e);
    }

    // Method 3: document.body.scrollTop (cho Safari cũ)
    try {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    } catch (e) {
      console.warn('[Order] Error with body.scrollTop:', e);
    }

    // Method 4: window.pageYOffset (backup)
    try {
      if (window.pageYOffset > 0) {
        window.scrollTo(0, 0);
      }
    } catch (e) {
      console.warn('[Order] Error with pageYOffset:', e);
    }
  }

  /**
   * Scroll to top với retry logic để đảm bảo hoạt động
   */
  private scrollToTopWithRetry(retryCount: number = 0, maxRetries: number = 3): void {
    // Kiểm tra vị trí scroll hiện tại
    const currentScrollTop =
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // Nếu đã ở top (tolerance 5px), không cần retry
    if (currentScrollTop <= 5) {
      return;
    }

    // Force scroll lại
    this.forceScrollToTop();

    // Retry nếu vẫn chưa scroll được về top
    if (retryCount < maxRetries) {
      setTimeout(() => {
        const stillScrollTop =
          window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

        // Nếu vẫn chưa ở top, retry
        if (stillScrollTop > 5) {
          this.scrollToTopWithRetry(retryCount + 1, maxRetries);
        }
      }, 50 * (retryCount + 1)); // Tăng delay mỗi lần retry: 50ms, 100ms, 150ms
    } else {
      // Lần cuối cùng: force scroll với mọi cách có thể
      this.forceScrollToTop();
      setTimeout(() => {
        this.forceScrollToTop();
      }, 50);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (event.target.innerWidth <= 1024) {
      this.setupScrollListener();
    } else {
      this.removeScrollListener();
    }
  }

  private scrollHandler: (() => void) | null = null;

  setupScrollListener(): void {
    if (this.scrollHandler) {
      return; // Đã có listener rồi
    }

    this.scrollHandler = () => {
      if (window.innerWidth > 1024) {
        return;
      }

      const paymentDetailsSection = document.getElementById('payment-details-section');
      if (!paymentDetailsSection) {
        return;
      }

      const paymentDetailsRect = paymentDetailsSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      // Kiểm tra xem payment details section đã scroll qua chưa
      // Khi bottom của payment details section vượt qua bottom của viewport
      if (paymentDetailsRect.bottom <= windowHeight) {
        // Đã scroll qua payment details section -> chuyển sang sticky (absolute position)
        this.isStickyBottom = true;
      } else {
        // Chưa scroll qua -> giữ fixed
        this.isStickyBottom = false;
      }
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    // Gọi lần đầu để set đúng trạng thái
    setTimeout(() => this.scrollHandler?.(), 100);
  }

  removeScrollListener(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
      this.isStickyBottom = false;
    }
  }

  ngOnDestroy() {
    if (this.addressSubscription) {
      this.addressSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.removeScrollListener();
  }

  calculateTotals() {
    // Tính tổng tiền hàng (giá đã bao gồm VAT)
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Tính VAT (chỉ để gửi lên backend, không dùng để tính subtotalWithVAT)
    // VAT được tính từ subtotal (giá đã bao gồm VAT) để lấy phần VAT trong giá
    this.vatAmount = Math.round((this.subtotal * this.vatRate) / (100 + this.vatRate));

    // Tổng tiền hàng đã gồm VAT (giá sản phẩm đã bao gồm VAT rồi, không cộng thêm)
    this.subtotalWithVAT = this.subtotal;

    // Miễn phí vận chuyển nếu subtotal >= 200,000 VND (trước khi áp khuyến mãi)
    const baseShippingFee = 30000;
    const isFreeShipping = this.subtotal >= 200000;
    const actualShippingFee = isFreeShipping ? 0 : baseShippingFee;

    if (this.selectedPromotion && this.isShippingPromotion(this.selectedPromotion)) {
      // Nếu đã miễn phí vận chuyển thì không áp dụng promotion shipping nữa
      const finalShippingFee = isFreeShipping
        ? 0
        : Math.max(0, actualShippingFee - this.getActualShippingDiscount());
      // Tổng = tổng tiền hàng (đã gồm VAT) + phí ship
      this.totalAmount = this.subtotalWithVAT + finalShippingFee;
    } else {
      // Giữ shippingFee = baseShippingFee để hiển thị (sẽ có dòng discount riêng nếu free shipping)
      this.shippingFee = baseShippingFee;
      // Tổng = tổng tiền hàng (đã gồm VAT) + phí ship - giảm giá sản phẩm
      this.totalAmount = this.subtotalWithVAT + actualShippingFee - this.discountAmount;
    }

    this.paymentInfo.amount = this.totalAmount;
  }

  isShippingPromotion(promotion: Promotion): boolean {
    return promotion.promotionType === 'Shipping';
  }

  getFinalShippingFee(): number {
    if (this.selectedPromotion && this.isShippingPromotion(this.selectedPromotion)) {
      const shippingDiscount = Math.min(this.selectedPromotion.discountValue, this.shippingFee);
      return this.shippingFee - shippingDiscount;
    }
    return this.shippingFee;
  }

  getActualShippingDiscount(): number {
    if (this.selectedPromotion && this.isShippingPromotion(this.selectedPromotion)) {
      return Math.min(this.selectedPromotion.discountValue, this.shippingFee);
    }
    return 0;
  }

  /**
   * Kiểm tra xem đơn hàng có được miễn phí vận chuyển không (subtotal >= 200,000 VND)
   */
  isFreeShipping(): boolean {
    return this.subtotal >= 200000;
  }

  // Address Modal Handlers
  onOpenAddressModal() {
    this.addressMode = 'add';
    this.currentEditingIndex = -1;
    this.addressInfo = {
      fullName: '',
      phone: '',
      email: '',
      city: '',
      district: '',
      ward: '',
      detail: '',
      deliveryMethod: 'standard',
    };
    this.showAddressModal = true;
  }

  onEditAddress(index: number) {
    const address = this.addressList[index];
    if (!address) return;

    this.addressMode = 'edit';
    this.currentEditingIndex = index;
    this.addressInfo = { ...address };
    this.showAddressModal = true;
  }

  onAddressComplete(addressInfo: FormAddressInfo) {
    console.log('📝 [Order] onAddressComplete called with addressInfo:', addressInfo);

    const serviceAddress: ServiceAddressInfo = {
      fullName: addressInfo.fullName,
      phone: addressInfo.phone,
      email: addressInfo.email,
      city: addressInfo.city,
      district: addressInfo.district,
      ward: addressInfo.ward,
      detail: addressInfo.detail,
      notes: addressInfo.notes || '',
      deliveryMethod: addressInfo.deliveryMethod,
      isDefault: addressInfo.isDefault, // Thêm isDefault vào serviceAddress
    };

    console.log('📝 [Order] Service address to save:', serviceAddress);

    if (this.addressMode === 'add') {
      console.log('📝 [Order] Adding new address...');
      // QUAN TRỌNG: Phải subscribe để Observable chạy
      this.addressService.addAddress(serviceAddress).subscribe({
        next: (success) => {
          console.log('📝 [Order] addAddress response - success:', success);
          if (success) {
            console.log('✅ [Order] Đã thêm địa chỉ thành công');

            // Đợi một chút để addresses$ subscription cập nhật addressList
            // Sau đó đóng modal và cập nhật selectedAddressIndex
            setTimeout(() => {
              // Tìm địa chỉ vừa thêm (thường là địa chỉ cuối cùng hoặc địa chỉ mặc định)
              const addresses = this.addressService.getAddresses();
              const newAddress = addresses.find(
                (addr) =>
                  addr.fullName === serviceAddress.fullName &&
                  addr.phone === serviceAddress.phone &&
                  addr.detail === serviceAddress.detail
              );

              if (newAddress) {
                const newIndex = addresses.indexOf(newAddress);
                if (newIndex >= 0) {
                  this.selectedAddressIndex = newIndex;
                  console.log('✅ [Order] Selected new address at index:', newIndex);
                }
              } else if (this.addressList.length > 0) {
                // Nếu không tìm thấy, chọn địa chỉ cuối cùng (mới thêm)
                this.selectedAddressIndex = this.addressList.length - 1;
                console.log(
                  '✅ [Order] Selected last address at index:',
                  this.selectedAddressIndex
                );
              }

              // Đóng modal sau khi đã cập nhật
              this.showAddressModal = false;
              console.log('✅ [Order] Modal closed and address displayed');
            }, 200); // Đợi 200ms để subscription cập nhật

            // AddressInfo sẽ được cập nhật tự động từ subscription callback
            // (addressList sẽ được cập nhật từ addresses$ subscription)
          } else {
            console.error('❌ [Order] Thêm địa chỉ thất bại');
            // Không đóng modal nếu thất bại, để user có thể thử lại
          }
        },
        error: (error) => {
          console.error('❌ [Order] Lỗi khi thêm địa chỉ:', error);
          // Không đóng modal nếu có lỗi
        },
      });
    } else if (this.addressMode === 'edit' && this.currentEditingIndex >= 0) {
      console.log('📝 [Order] Updating address at index:', this.currentEditingIndex);
      const addresses = this.addressService.getAddresses();
      const addressId = addresses[this.currentEditingIndex]?._id;
      if (addressId) {
        // QUAN TRỌNG: Phải subscribe để Observable chạy
        this.addressService.updateAddress(addressId, serviceAddress).subscribe({
          next: (success) => {
            console.log('📝 [Order] updateAddress response - success:', success);
            if (success) {
              console.log('✅ [Order] Đã cập nhật địa chỉ thành công');

              // Đợi một chút để addresses$ subscription cập nhật addressList
              setTimeout(() => {
                // Giữ nguyên selectedAddressIndex (đang edit địa chỉ đó)
                if (this.addressList[this.currentEditingIndex]) {
                  this.selectedAddressIndex = this.currentEditingIndex;
                  this.addressInfo = { ...this.addressList[this.currentEditingIndex] };
                  console.log('✅ [Order] Updated addressInfo after edit:', this.addressInfo);
                }

                // Đóng modal sau khi đã cập nhật
                this.showAddressModal = false;
                console.log('✅ [Order] Modal closed after edit');
              }, 200);

              // AddressInfo sẽ được cập nhật tự động từ subscription callback
            } else {
              console.error('❌ [Order] Cập nhật địa chỉ thất bại');
              // Không đóng modal nếu thất bại
            }
          },
          error: (error) => {
            console.error('❌ [Order] Lỗi khi cập nhật địa chỉ:', error);
            // Không đóng modal nếu có lỗi
          },
        });
      } else {
        console.error('❌ [Order] Không tìm thấy addressId để update');
      }
    } else {
      console.warn('⚠️ [Order] Unknown address mode:', this.addressMode);
      this.showAddressModal = false;
    }
  }

  onCloseAddressModal() {
    this.showAddressModal = false;
  }

  // Address List Modal Handlers
  onOpenAddressListModal() {
    this.showAddressListModal = true;
  }

  onCloseAddressListModal() {
    this.showAddressListModal = false;
  }

  onSelectAddressFromList(index: number) {
    this.selectAddress(index);
    this.showAddressListModal = false;
  }

  onEditAddressFromList(index: number) {
    this.onEditAddress(index);
    this.showAddressListModal = false;
  }

  onDeleteAddress(index: number) {
    const addresses = this.addressService.getAddresses();
    const addressId = addresses[index]?._id;
    if (!addressId) return;

    // QUAN TRỌNG: Phải subscribe để Observable chạy
    this.addressService.deleteAddress(addressId).subscribe({
      next: (success) => {
        if (success) {
          console.log(' Đã xóa địa chỉ thành công');
          setTimeout(() => {
            if (this.selectedAddressIndex >= this.addressList.length) {
              this.selectedAddressIndex = Math.max(0, this.addressList.length - 1);
            }

            if (this.addressList.length > 0 && this.addressList[this.selectedAddressIndex]) {
              this.addressInfo = { ...this.addressList[this.selectedAddressIndex] };
              console.log(' Đã chọn địa chỉ mới sau khi xóa:', this.addressInfo);
            }
          }, 100);
        } else {
          console.error(' Xóa địa chỉ thất bại');
        }
      },
      error: (error) => {
        console.error(' Lỗi khi xóa địa chỉ:', error);
      },
    });
  }

  onAddNewAddressFromList() {
    this.onOpenAddressModal();
    this.showAddressListModal = false;
  }

  // Invoice Handlers
  onInvoiceInfoChange(invoiceInfo: any) {
    this.invoiceInfo = invoiceInfo;
  }

  onInvoiceToggleExpanded(expanded: boolean) {
    // Handle invoice form toggle
  }

  onTaxIdInput() {
    if (this.invoiceErrors && this.invoiceErrors.taxId) {
      delete this.invoiceErrors.taxId;
    }
  }

  onTaxIdBlur() {
    this.validateTaxId();
  }

  onInvoiceEmailInput() {
    if (this.invoiceErrors && this.invoiceErrors.invoiceEmail) {
      delete this.invoiceErrors.invoiceEmail;
    }
  }

  onInvoiceEmailBlur() {
    this.validateInvoiceEmail();
  }

  validateTaxId() {
    if (!this.wantInvoice) return;

    if (!this.invoiceInfo.taxId || this.invoiceInfo.taxId.trim() === '') {
      this.invoiceErrors = { ...this.invoiceErrors, taxId: 'Mã số thuế là bắt buộc' };
    } else if (!this.isValidTaxId(this.invoiceInfo.taxId)) {
      this.invoiceErrors = {
        ...this.invoiceErrors,
        taxId: 'Mã số thuế không hợp lệ (10 hoặc 13 chữ số)',
      };
    } else {
      this.invoiceErrors = { ...this.invoiceErrors };
      delete this.invoiceErrors.taxId;
    }
  }

  validateInvoiceEmail() {
    if (!this.wantInvoice) return;

    if (!this.invoiceInfo.invoiceEmail || this.invoiceInfo.invoiceEmail.trim() === '') {
      this.invoiceErrors = {
        ...this.invoiceErrors,
        invoiceEmail: 'Email nhận hóa đơn là bắt buộc',
      };
    } else if (!this.isValidInvoiceEmail(this.invoiceInfo.invoiceEmail)) {
      this.invoiceErrors = { ...this.invoiceErrors, invoiceEmail: 'Email không hợp lệ' };
    } else {
      this.invoiceErrors = { ...this.invoiceErrors };
      delete this.invoiceErrors.invoiceEmail;
    }
  }

  clearInvoiceField(fieldName: string, inputElement: HTMLInputElement) {
    (this.invoiceInfo as any)[fieldName] = '';

    if (this.invoiceErrors[fieldName]) {
      delete this.invoiceErrors[fieldName];
      this.invoiceErrors = { ...this.invoiceErrors };
    }

    setTimeout(() => {
      inputElement.focus();
    }, 0);
  }

  // Payment Modal Handlers
  onOpenPaymentModal() {
    if (!this.isAddressComplete()) {
      this.onOpenAddressModal();
      return;
    }

    this.calculateTotals();
    this.paymentInfo.amount = this.totalAmount;
    this.showPaymentModal = true;
  }

  onPaymentComplete(result: PaymentResult) {
    this.showPaymentModal = false;
    if (result.success) {
      // Tạo đơn hàng sau khi thanh toán thành công
      this.createOrder();
    } else {
      // Không hiển thị alert nếu người dùng tự hủy thanh toán
      if (result.error && result.error !== 'Thanh toán đã bị hủy') {
        this.showPaymentError(result.error || 'Thanh toán thất bại');
      }
    }
  }

  onClosePaymentModal() {
    this.showPaymentModal = false;
  }

  removePurchasedItemsFromCart() {
    // console.log(' [Order] Removing purchased items from cart');

    // Lấy danh sách SKU của các items đã đặt hàng
    const purchasedSkus = this.cartItems
      .map((item) => item.sku)
      .filter((sku): sku is string => sku !== undefined && sku !== '');

    // console.log(` [Order] SKUs to remove (${purchasedSkus.length}):`, purchasedSkus);

    if (purchasedSkus.length === 0) {
      // console.warn(' [Order] No SKUs found to remove');
      return;
    }

    // Xóa chỉ những items đã đặt hàng (không xóa toàn bộ cart)
    this.cartService.removeMultipleItems(purchasedSkus).subscribe({
      next: () => {
        console.log(` [Order] Removed ${purchasedSkus.length} purchased items from cart`);
      },
      error: (error: any) => {
        console.error(' [Order] Error removing purchased items:', error);
      },
    });

    // Clear promotion
    this.cartService.clearPromotion();
  }

  // Promotion Modal Handlers
  onOpenPromotionModal() {
    this.showPromotionModal = true;
  }

  onPromotionApplied(result: PromotionResult) {
    this.selectedPromotion = result.selectedPromotion;
    this.discountAmount = result.discountAmount;
    this.finalAmount = result.finalAmount;
    this.calculateTotals();
  }

  onClosePromotionModal() {
    this.calculateTotals();
    this.showPromotionModal = false;
  }

  onConfirmPromotion() {
    this.calculateTotals();
    this.showPromotionModal = false;
  }

  // Validation
  isAddressComplete(): boolean {
    const currentAddress = this.getCurrentAddress();
    if (!currentAddress) {
      return false;
    }

    return !!(
      currentAddress.fullName &&
      currentAddress.phone &&
      currentAddress.city &&
      currentAddress.district &&
      currentAddress.ward &&
      currentAddress.detail
    );
  }

  isDeliveryMethodSelected(): boolean {
    return !!this.addressInfo.deliveryMethod;
  }

  isDeliveryAddressSelected(): boolean {
    return !!(this.selectedDeliveryAddress && this.selectedDeliveryAddress.trim() !== '');
  }

  isPaymentMethodSelected(): boolean {
    return !!this.paymentInfo.method;
  }

  isInvoiceInfoComplete(): boolean {
    if (!this.wantInvoice) {
      return true;
    }

    return !!(
      this.invoiceInfo.companyName &&
      this.invoiceInfo.taxId &&
      this.invoiceInfo.invoiceEmail &&
      this.invoiceInfo.invoiceAddress &&
      this.isValidTaxId(this.invoiceInfo.taxId) &&
      this.isValidInvoiceEmail(this.invoiceInfo.invoiceEmail)
    );
  }

  isValidTaxId(taxId: string): boolean {
    if (!taxId || taxId.trim() === '') {
      return false;
    }

    const cleanTaxId = taxId.replace(/[\s-]/g, '');

    if (!/^\d+$/.test(cleanTaxId)) {
      return false;
    }

    if (cleanTaxId.length !== 10 && cleanTaxId.length !== 13) {
      return false;
    }

    return true;
  }

  isValidInvoiceEmail(email: string): boolean {
    if (!email || email.trim() === '') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  isAllRequiredFieldsComplete(): boolean {
    return (
      this.isAddressComplete() &&
      this.isDeliveryMethodSelected() &&
      this.isDeliveryAddressSelected() &&
      this.isPaymentMethodSelected() &&
      this.isInvoiceInfoComplete()
    );
  }

  hasAddressInfo(): boolean {
    return this.addressList.length > 0;
  }

  getCurrentAddress(): FormAddressInfo | null {
    if (this.addressList.length === 0 || this.selectedAddressIndex < 0) {
      return null;
    }
    return this.addressList[this.selectedAddressIndex];
  }

  isAddressSelected(index: number): boolean {
    return index === this.selectedAddressIndex;
  }

  selectAddress(index: number) {
    if (index >= 0 && index < this.addressList.length) {
      this.selectedAddressIndex = index;
      this.addressInfo = { ...this.addressList[index] };
    }
  }

  // Delivery address dropdown methods
  toggleDeliveryDropdown() {
    this.showDeliveryDropdown = !this.showDeliveryDropdown;
  }

  closeDeliveryDropdown() {
    this.showDeliveryDropdown = false;
  }

  selectDeliveryAddress(address: string) {
    this.selectedDeliveryAddress = address;
    this.closeDeliveryDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const deliverySelect = target.closest('.delivery-select');

    if (!deliverySelect && this.showDeliveryDropdown) {
      this.closeDeliveryDropdown();
    }
  }

  // Order Processing
  onPlaceOrder() {
    // Validate cart items first
    if (!this.cartItems || this.cartItems.length === 0) {
      this.toastService.show('Vui lòng thêm sản phẩm vào giỏ hàng trước khi đặt hàng', 'error');
      return;
    }

    if (!this.isAllRequiredFieldsComplete()) {
      if (!this.isAddressComplete()) {
        this.onOpenAddressModal();
        return;
      }
      this.toastService.show('Vui lòng điền đầy đủ tất cả thông tin bắt buộc', 'error');
      return;
    }

    if (this.paymentInfo.method === 'cod') {
      this.processCODOrder();
    } else {
      this.onOpenPaymentModal();
    }
  }

  private processCODOrder() {
    // console.log('� [Order] Processing COD order...');
    this.createOrder();
  }

  /**
   * Tạo đơn hàng và gửi lên MongoDB
   */
  private createOrder() {
    const customerID = this.orderService.getCustomerID();

    if (customerID === 'guest') {
      alert('Vui lòng đăng nhập để đặt hàng');
      return;
    }

    // Validate cart items
    if (!this.cartItems || this.cartItems.length === 0) {
      console.error('❌ [Order] Cannot create order: cart is empty');
      this.toastService.show('Vui lòng thêm sản phẩm vào giỏ hàng trước khi đặt hàng', 'error');
      return;
    }

    // Validate address info
    if (
      !this.addressInfo ||
      !this.addressInfo.fullName ||
      !this.addressInfo.phone ||
      !this.addressInfo.city ||
      !this.addressInfo.district ||
      !this.addressInfo.ward ||
      !this.addressInfo.detail
    ) {
      console.error('❌ [Order] Cannot create order: address info is incomplete', this.addressInfo);
      this.toastService.show('Vui lòng điền đầy đủ thông tin địa chỉ giao hàng', 'error');
      this.onOpenAddressModal();
      return;
    }

    console.log('📦 [Order] Creating order with:', {
      customerID,
      cartItemsCount: this.cartItems.length,
      addressInfo: {
        fullName: this.addressInfo.fullName,
        phone: this.addressInfo.phone,
        city: this.addressInfo.city,
        district: this.addressInfo.district,
        ward: this.addressInfo.ward,
        detail: this.addressInfo.detail,
      },
    });

    // Prepare order items
    // Items đã có sẵn itemType từ cart, chỉ cần map sang OrderItem format
    const orderItems: OrderItem[] = this.cartItems.map((item, index) => {
      // Đảm bảo itemType được giữ nguyên từ cartItems
      const itemType = item.itemType || 'purchased';

      console.log(
        `📦 [Order] Creating order item ${index}: SKU=${item.sku}, itemType=${item.itemType}, finalItemType=${itemType}`
      );

      return {
        sku: item.sku || String(item.id),
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image,
        unit: item.unit || '',
        category: item.category,
        subcategory: item.subcategory,
        itemType: itemType, // Giữ nguyên itemType từ cartItems
        originalPrice: item.originalPrice || item.price,
      };
    });

    // Đảm bảo tất cả items đều có itemType
    orderItems.forEach((item, index) => {
      if (!item.itemType) {
        console.warn(`⚠️ [Order] Item ${index} missing itemType, defaulting to 'purchased':`, item);
        item.itemType = 'purchased';
      }
    });

    console.log('📦 [Order] Order items prepared:', orderItems);
    console.log('📦 [Order] Item types summary:', {
      purchased: orderItems.filter((i) => i.itemType === 'purchased').length,
      gifted: orderItems.filter((i) => i.itemType === 'gifted').length,
      total: orderItems.length,
    });
    console.log(
      '📦 [Order] Detailed order items with itemType:',
      orderItems.map((item) => ({
        sku: item.sku,
        productName: item.productName,
        itemType: item.itemType,
        quantity: item.quantity,
        price: item.price,
      }))
    );

    // Calculate shipping discount and product discount
    // Kiểm tra free shipping (subtotal >= 200000)
    const isFreeShipping = this.subtotal >= 200000;
    const baseShippingFee = 30000;

    let shippingDiscount = 0;
    if (isFreeShipping) {
      // Miễn phí vận chuyển = giảm 30,000
      shippingDiscount = baseShippingFee;
    } else if (this.selectedPromotion && this.isShippingPromotion(this.selectedPromotion)) {
      // Áp dụng promotion shipping discount
      shippingDiscount = this.getActualShippingDiscount();
    }

    const productDiscount =
      this.selectedPromotion && !this.isShippingPromotion(this.selectedPromotion)
        ? this.discountAmount
        : 0;

    // Prepare order request
    const orderRequest: CreateOrderRequest = {
      CustomerID: customerID,
      shippingInfo: {
        fullName: this.addressInfo.fullName,
        phone: this.addressInfo.phone,
        email: this.addressInfo.email || '',
        address: {
          city: this.addressInfo.city,
          district: this.addressInfo.district,
          ward: this.addressInfo.ward,
          detail: this.addressInfo.detail,
        },
        deliveryMethod: this.addressInfo.deliveryMethod,
        warehouseAddress: this.selectedDeliveryAddress,
        notes: this.addressInfo.notes || '',
      },
      items: orderItems,
      paymentMethod: this.paymentInfo.method as any,
      subtotal: this.subtotal,
      shippingFee: baseShippingFee, // Luôn gửi base shipping fee (30000)
      shippingDiscount: shippingDiscount, // Discount sẽ bao gồm free shipping hoặc promotion
      discount: productDiscount,
      vatRate: this.vatRate,
      vatAmount: this.vatAmount,
      totalAmount: this.totalAmount,
      code: this.selectedPromotion?.code || '',
      promotionName: this.selectedPromotion?.name || '',
      wantInvoice: this.wantInvoice,
      invoiceInfo: this.wantInvoice ? this.invoiceInfo : {},
      consultantCode: this.consultantCode,
    };

    console.log('📦 [Order] Sending order to backend:', {
      CustomerID: orderRequest.CustomerID,
      itemsCount: orderRequest.items.length,
      shippingInfo: orderRequest.shippingInfo,
      subtotal: orderRequest.subtotal,
      totalAmount: orderRequest.totalAmount,
    });

    // Call OrderService to create order
    this.orderService.createOrder(orderRequest).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // console.log(' [Order] Order created successfully:', response.data);
          this.removePurchasedItemsFromCart();
          this.showOrderSuccess(response.data.OrderID);
        } else {
          // console.error(' [Order] Failed to create order:', response.message);
          // Hiển thị toast màu đỏ cho lỗi
          this.toastService.show(
            'Lỗi tạo đơn hàng: ' + (response.message || 'Unknown error'),
            'error'
          );
        }
      },
      error: (error) => {
        // console.error(' [Order] Error creating order:', error);
        // Hiển thị toast màu đỏ cho lỗi
        const errorMessage = error.message || 'Có lỗi xảy ra khi tạo đơn hàng';
        this.toastService.show('Lỗi tạo đơn hàng: ' + errorMessage, 'error');
      },
    });
  }

  private showOrderSuccess(orderId: string) {
    // Lưu order ID để hiển thị trong modal
    this.createdOrderId = orderId;
    this.showOrderSuccessModal = true;

    // Trigger storage event để orders component biết có order mới
    localStorage.setItem('newOrderCreated', Date.now().toString());
    localStorage.removeItem('newOrderCreated');
  }

  onViewOrders(): void {
    this.showOrderSuccessModal = false;
    this.router.navigate(['/account/orders'], { queryParams: { tab: 'pending' } });
  }

  onGoToHome(): void {
    this.showOrderSuccessModal = false;
    this.router.navigate(['/']);
  }

  private showPaymentError(error: string) {
    alert('Lỗi thanh toán: ' + error);
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + '₫';
  }

  getAddressDisplay(): { name: string; address: string } {
    if (!this.hasAddressInfo()) {
      return {
        name: 'Thông tin người dùng nhập lúc này',
        address: '',
      };
    }

    const cityName = this.addressService.getCityNameFromId(this.addressInfo.city);
    const districtName = this.addressService.getDistrictNameFromId(this.addressInfo.district);
    const wardName = this.addressService.getWardNameFromId(this.addressInfo.ward);

    const addressParts = [this.addressInfo.detail, wardName, districtName, cityName].filter(
      (part) => part && part.trim() !== ''
    );

    return {
      name: this.addressInfo.fullName,
      address: addressParts.join(', '),
    };
  }

  getAddressString(address: FormAddressInfo): string {
    // Sử dụng AddressService để format địa chỉ tiếng Việt có dấu và viết hoa
    // Phải truyền đầy đủ tham số để tìm đúng tên từ address tree
    const cityName = this.addressService.getCityNameFromId(address.city);
    const districtName = this.addressService.getDistrictNameFromId(address.district, address.city);
    const wardName = this.addressService.getWardNameFromId(
      address.ward,
      address.city,
      address.district
    );

    const addressParts = [address.detail, wardName, districtName, cityName].filter(
      (part) => part && part.trim() !== ''
    );

    return addressParts.join(', ');
  }

  getAddressNameWithPhone(address: FormAddressInfo): string {
    return `${address.fullName} - ${address.phone}`;
  }

  // Kiểm tra xem địa chỉ có phải là địa chỉ mặc định không
  isDefaultAddress(index: number): boolean {
    const addresses = this.addressService.getAddresses();
    if (index >= 0 && index < addresses.length) {
      return addresses[index]?.isDefault || false;
    }
    return false;
  }

  // Load promotions và targets để check buy1get1
  private loadPromotionsAndTargets(): void {
    const apiUrl = 'http://localhost:3000/api';
    forkJoin({
      promotions: this.http.get<any>(`${apiUrl}/promotions`),
      targets: this.http.get<any>(`${apiUrl}/promotion-targets`),
    }).subscribe({
      next: ({ promotions, targets }) => {
        // Filter active promotions
        const now = new Date();
        const activePromotions = (promotions.data || []).filter((p: any) => {
          const startDate = new Date(p.start_date);
          const endDate = new Date(p.end_date);
          return p.status === 'Active' && now >= startDate && now <= endDate;
        });

        this.promotions = activePromotions;
        this.promotionTargets = targets?.data || [];

        // Cập nhật buy1get1 status cho cart items
        this.updateBuy1Get1Status();
      },
      error: (error) => {
        console.error('❌ [Order] Error loading promotions:', error);
      },
    });
  }

  // Cập nhật trạng thái buy1get1 cho cart items
  private updateBuy1Get1Status(): void {
    this.cartItems.forEach((item) => {
      item.hasBuy1Get1 = this.checkBuy1Get1Promotion(item);
    });
  }

  // Kiểm tra xem sản phẩm có khuyến mãi buy1get1 không
  checkBuy1Get1Promotion(item: CartItem): boolean {
    if (!item.sku) return false;

    // Tìm promotion targets áp dụng cho sản phẩm này
    const applicableTargets = this.promotionTargets.filter((target) => {
      return this.isProductMatchTarget(item, target);
    });

    if (applicableTargets.length === 0) return false;

    // Tìm promotions tương ứng
    const applicablePromotions = applicableTargets
      .map((target) => this.promotions.find((p) => p.promotion_id === target.promotion_id))
      .filter((p): p is any => p !== undefined);

    // Kiểm tra xem có promotion nào có discount_type là buy1get1 không
    return applicablePromotions.some((p) => p.discount_type === 'buy1get1');
  }

  // Kiểm tra xem sản phẩm có match với promotion target không
  private isProductMatchTarget(item: CartItem, target: any): boolean {
    if (!target || !item.sku) return false;

    const targetType = target.target_type;
    const targetRefs = target.target_ref || [];

    switch (targetType) {
      case 'Product':
        // Match theo SKU
        return targetRefs.some((ref: string) => {
          const refSku = ref.trim();
          return refSku === item.sku || refSku === item.name;
        });

      case 'Category':
        // Match theo category
        return targetRefs.some((ref: string) => {
          const refCategory = ref.trim().toLowerCase();
          return refCategory === item.category?.toLowerCase();
        });

      case 'Brand':
        // Match theo brand (nếu có)
        return false; // Tạm thời return false vì CartItem không có brand

      default:
        return false;
    }
  }

  // Lấy số lượng sản phẩm tặng kèm (bằng số lượng mua)
  getFreeItemQuantity(item: CartItem): number {
    if (item.hasBuy1Get1) {
      return item.quantity;
    }
    return 0;
  }

  // Lấy danh sách items purchased (chỉ hiển thị purchased items trong danh sách chính)
  getPurchasedItems(): CartItem[] {
    return this.cartItems.filter((item) => item.itemType !== 'gifted');
  }

  // Tìm gifted item tương ứng với purchased item (cùng SKU)
  getGiftedItem(purchasedItem: CartItem): CartItem | null {
    if (!purchasedItem.sku) return null;

    const giftedItem = this.cartItems.find(
      (item) => item.sku === purchasedItem.sku && item.itemType === 'gifted'
    );

    return giftedItem || null;
  }

  // Kiểm tra xem purchased item có gifted item tương ứng không
  hasGiftedItem(item: CartItem): boolean {
    return this.getGiftedItem(item) !== null;
  }
}
