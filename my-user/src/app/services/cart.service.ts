import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { of, Observable, firstValueFrom } from 'rxjs';
import { ToastService } from './toast.service';
import { ProductService } from './product.service';

interface CartItem {
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  image: string;
  unit: string;
  category: string;
  subcategory: string;
  originalPrice?: number;
  hasPromotion?: boolean;
  hasBuy1Get1?: boolean; // Có khuyến mãi buy1get1 không
  itemType?: 'purchased' | 'gifted'; // Loại item: mua hoặc tặng kèm
  // Frontend specific fields
  id?: number;
  name?: string;
  selected?: boolean;
}

interface Cart {
  CustomerID: string;
  items: CartItem[];
  itemCount: number;
  totalQuantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private http = inject(HttpClient);
  private toastService = inject(ToastService);
  private productService = inject(ProductService);
  private apiUrl = '/api/cart'; // Use proxy configuration

  private isOpen = signal(false);
  private cartItems = signal<any[]>([]);
  private selectedPromotion = signal<any>(null);
  private discountAmount = signal<number>(0);
  private finalAmount = signal<number>(0);
  private shouldOpenAddressModal = signal<boolean>(false);
  private isLoading = signal<boolean>(false);
  private promotions: any[] = []; // Lưu promotions để check buy1get1
  private promotionTargets: any[] = []; // Lưu promotion targets để check buy1get1

  constructor() {
    // Auto-load cart from backend when service initializes
    this.loadCart();
    // Load promotions và targets để check buy1get1
    this.loadPromotionsAndTargets();
  }

  // Computed signals
  selectedItems = computed(() => this.cartItems().filter((item) => item.selected));
  // selectedCount chỉ đếm purchased items (không đếm gifted items)
  selectedCount = computed(
    () => this.selectedItems().filter((item) => item.itemType !== 'gifted').length
  );
  totalAmount = computed(() =>
    // Chỉ tính subtotal cho items có itemType = 'purchased' (không tính items tặng kèm)
    this.selectedItems()
      .filter((item) => item.itemType !== 'gifted')
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  isCheckoutEnabled = computed(() => this.selectedCount() > 0);

  // Computed cho tổng số lượng sản phẩm trong cart
  totalQuantity = computed(() =>
    this.cartItems().reduce((total, item) => total + item.quantity, 0)
  );

  // Computed cho số sản phẩm khác nhau (totalCount) - chỉ đếm purchased items
  totalCount = computed(() => this.cartItems().filter((item) => item.itemType !== 'gifted').length);

  // Computed để kiểm tra xem đã đạt giới hạn chưa (100 sản phẩm khác nhau)
  isAtLimit = computed(() => this.totalCount() >= 100);

  // Getters
  getIsOpen() {
    return this.isOpen.asReadonly();
  }

  getCartItems() {
    return this.cartItems.asReadonly();
  }

  getSelectedPromotion() {
    return this.selectedPromotion.asReadonly();
  }

  getDiscountAmount() {
    return this.discountAmount.asReadonly();
  }

  getFinalAmount() {
    return this.finalAmount.asReadonly();
  }

  getShouldOpenAddressModal() {
    return this.shouldOpenAddressModal.asReadonly();
  }

  getTotalQuantity() {
    return this.totalQuantity;
  }

  getTotalCount() {
    return this.totalCount;
  }

  getIsAtLimit() {
    return this.isAtLimit;
  }

  getIsLoading() {
    return this.isLoading.asReadonly();
  }

  // Helper methods
  private getCustomerID(): string {
    // Try to get from localStorage (từ auth service)
    const userStr = localStorage.getItem('user'); //  Key đúng là 'user', không phải 'currentUser'

    if (!userStr) {
      console.log(' [CartService] No user in localStorage using guest');
      return 'guest';
    }

    try {
      const userData = JSON.parse(userStr);
      const customerId = userData.CustomerID || userData._id || 'guest';
      console.log(` [CartService] User found CustomerID: ${customerId}`);
      return customerId;
    } catch (error) {
      console.error(' [CartService] Error parsing user data:', error);
      return 'guest';
    }
  }

  private mapToBackendItem(item: any): CartItem {
    return {
      sku: item.sku || item.id?.toString() || '',
      productName: item.name || item.productName || '',
      quantity: item.quantity || 1,
      price: item.price || 0,
      image: item.image || '',
      unit: item.unit || '',
      category: item.category || '',
      subcategory: item.subcategory || '',
      originalPrice: item.originalPrice,
      hasPromotion: item.hasPromotion || false,
    };
  }

  private mapToFrontendItem(item: CartItem): any {
    // Validate: Nếu có promotion và có originalPrice hợp lệ, hiển thị promotion
    // Chỉ hiển thị khi originalPrice > price (có giảm giá thực sự)
    // Cho phép một chút sai số do làm tròn (tolerance = 1%)
    const priceTolerance = item.price * 0.01;
    const hasValidPromotion =
      item.hasPromotion &&
      item.originalPrice !== undefined &&
      item.originalPrice !== null &&
      typeof item.originalPrice === 'number' &&
      typeof item.price === 'number' &&
      item.originalPrice > item.price - priceTolerance; // Cho phép sai số nhỏ do làm tròn

    return {
      id: parseInt(item.sku) || 0,
      sku: item.sku,
      name: item.productName,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      unit: item.unit,
      category: item.category,
      subcategory: item.subcategory,
      selected: true,
      originalPrice: hasValidPromotion ? item.originalPrice : undefined,
      hasPromotion: hasValidPromotion,
      hasBuy1Get1: item.hasBuy1Get1 || false,
      itemType: item.itemType || 'purchased', // Mặc định là purchased
    };
  }

  // Load cart from backend
  loadCart() {
    const customerID = this.getCustomerID();
    console.log(' [CartService] Loading cart for:', customerID);

    this.isLoading.set(true);

    this.http
      .get<any>(`${this.apiUrl}/${customerID}`)
      .pipe(
        tap((response) => {
          console.log(' [CartService] Cart loaded:', response);
          if (response.success && response.data) {
            const frontendItems = response.data.items.map((item: CartItem) =>
              this.mapToFrontendItem(item)
            );
            console.log(
              ' [CartService] Frontend items before expansion:',
              frontendItems.map((item: any) => ({
                sku: item.sku,
                name: item.name,
                itemType: item.itemType,
              }))
            );
            // Tách items thành purchased/gifted nếu có buy1get1
            const expandedItems = this.expandBuy1Get1Items(frontendItems);
            console.log(
              ' [CartService] Expanded items after buy1get1:',
              expandedItems.map((item) => ({
                sku: item.sku,
                name: item.name,
                itemType: item.itemType,
                hasBuy1Get1: item.hasBuy1Get1,
              }))
            );
            this.cartItems.set(expandedItems);
          }
          this.isLoading.set(false);
        }),
        catchError((error) => {
          console.error(' [CartService] Error loading cart:', error);
          this.isLoading.set(false);
          // Fallback to empty cart
          this.cartItems.set([]);
          return of(null);
        })
      )
      .subscribe();
  }

  // Cart state management
  openCart() {
    this.isOpen.set(true);
  }

  closeCart() {
    this.isOpen.set(false);
  }

  setShouldOpenAddressModal(shouldOpen: boolean) {
    this.shouldOpenAddressModal.set(shouldOpen);
  }

  toggleCart() {
    this.isOpen.set(!this.isOpen());
  }

  /**
   * Kiểm tra tồn kho trước khi thêm vào giỏ hàng
   * @param item - Item muốn thêm vào giỏ (có thể có stock hoặc không)
   * @param quantityToAdd - Số lượng muốn thêm (mặc định 1)
   * @param availableStock - Tồn kho có sẵn (nếu không có sẽ lấy từ API)
   * @param isBuyNow - true nếu là "Mua ngay", false nếu là "Thêm vào giỏ" (mặc định false)
   * @returns Promise<boolean> - true nếu đủ tồn kho, false nếu không đủ
   */
  async checkStockBeforeAdd(
    item: any,
    quantityToAdd: number = 1,
    availableStock?: number,
    isBuyNow: boolean = false
  ): Promise<boolean> {
    try {
      // Lấy số lượng hiện tại trong giỏ hàng của sản phẩm này
      const existingItem = this.cartItems().find((cartItem) => {
        if (cartItem.sku && item.sku) {
          return cartItem.sku === item.sku && cartItem.itemType !== 'gifted';
        }
        const cartItemId = typeof cartItem.id === 'string' ? parseInt(cartItem.id) : cartItem.id;
        const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
        return cartItemId === itemId && cartItem.itemType !== 'gifted';
      });

      const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
      const totalQuantityAfterAdd = currentQuantityInCart + quantityToAdd;

      // Kiểm tra xem có khuyến mãi buy1get1 không
      const hasBuy1Get1 = item.hasBuy1Get1 || false;
      // Nếu có buy1get1, số lượng cần thiết sẽ nhân đôi
      const requiredStock = hasBuy1Get1 ? totalQuantityAfterAdd * 2 : totalQuantityAfterAdd;

      // Lấy stock nếu chưa có
      let stock = availableStock;
      if (stock === undefined || stock === null) {
        // Thử lấy từ item trực tiếp (có thể là Stock hoặc stock)
        stock = item.Stock ?? item.stock;
      }

      // Nếu vẫn chưa có stock, lấy từ API
      if ((stock === undefined || stock === null) && item.sku) {
        try {
          const product = await firstValueFrom(this.productService.getProductBySku(item.sku));
          if (product) {
            // Backend có thể trả về stock hoặc quantity
            stock =
              (product as any).stock ?? (product as any).Stock ?? (product as any).quantity ?? 0;
          }
        } catch (error) {
          console.error('Error fetching product stock:', error);
          // Nếu không lấy được stock, cho phép thêm (fallback)
          return true;
        }
      }

      // Nếu vẫn không có stock, cho phép thêm (fallback)
      if (stock === undefined || stock === null) {
        return true;
      }

      // Kiểm tra tồn kho
      if (requiredStock > stock) {
        let stockMessage: string;
        if (isBuyNow) {
          // Nếu là "Mua ngay"
          stockMessage = 'Số lượng vượt quá tồn kho';
        } else {
          // Nếu là "Thêm vào giỏ"
          stockMessage = 'Số lượng vượt quá tồn kho. Hãy kiểm tra giỏ hàng';
        }
        this.toastService.show(stockMessage, 'error');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking stock:', error);
      // Nếu có lỗi, cho phép thêm (fallback)
      return true;
    }
  }

  // Cart items management
  addToCart(item: any, showToast: boolean = true) {
    const customerID = this.getCustomerID();

    // Kiểm tra xem user đã đăng nhập chưa
    if (customerID === 'guest') {
      console.warn(' [CartService] Guest user cannot add to cart - login required');
      alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!');
      return;
    }

    // So sánh bằng cả id và sku để đảm bảo tìm đúng sản phẩm
    // Ưu tiên so sánh bằng sku (nhất quán hơn), sau đó mới đến id
    const existingItem = this.cartItems().find((cartItem) => {
      // So sánh bằng sku trước (nếu có)
      if (cartItem.sku && item.sku) {
        return cartItem.sku === item.sku;
      }
      // Nếu không có sku, so sánh bằng id (convert về cùng kiểu để đảm bảo)
      const cartItemId = typeof cartItem.id === 'string' ? parseInt(cartItem.id) : cartItem.id;
      const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
      return cartItemId === itemId;
    });

    if (existingItem) {
      // Tăng số lượng và đưa sản phẩm lên đầu danh sách, đảm bảo selected = true
      // Cập nhật originalPrice và hasPromotion từ item mới nếu có (để đảm bảo thông tin promotion luôn mới nhất)
      const updatedItem = {
        ...existingItem,
        quantity: existingItem.quantity + 1,
        selected: true,
        // Giữ lại originalPrice và hasPromotion từ item mới nếu có, nếu không thì giữ từ item cũ
        originalPrice:
          item.originalPrice !== undefined ? item.originalPrice : existingItem.originalPrice,
        hasPromotion:
          item.hasPromotion !== undefined ? item.hasPromotion : existingItem.hasPromotion,
      };

      // Lọc ra các item khác (không phải item này và item gifted tương ứng) - sử dụng cùng logic so sánh
      const otherItems = this.cartItems().filter((cartItem) => {
        // Bỏ qua cả item purchased và item gifted tương ứng
        if (cartItem.sku && item.sku) {
          return cartItem.sku !== item.sku;
        }
        // Nếu không có sku, so sánh bằng id
        const cartItemId = typeof cartItem.id === 'string' ? parseInt(cartItem.id) : cartItem.id;
        const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
        return cartItemId !== itemId;
      });

      // Tách items thành purchased/gifted nếu có buy1get1
      const expandedItems = this.expandBuy1Get1Items([updatedItem]);

      // Đưa sản phẩm đã cập nhật lên đầu danh sách
      this.cartItems.set([...expandedItems, ...otherItems]);

      // Hiển thị toast notification nếu được bật
      if (showToast) {
        this.toastService.show('Đã thêm vào giỏ hàng!');
      }

      // Update backend (chỉ update item purchased, không update gifted)
      const purchasedItem = expandedItems.find((i) => i.itemType === 'purchased') || updatedItem;
      const backendItem = this.mapToBackendItem({ ...purchasedItem, quantity: 1 });
      this.http
        .post<any>(`${this.apiUrl}/${customerID}/add`, backendItem)
        .pipe(
          tap((response) => {
            console.log(
              ' [CartService] Item quantity updated in backend and moved to top:',
              response
            );
          }),
          catchError((error) => {
            console.error(' [CartService] Error updating item in backend:', error);
            // Rollback nếu backend lỗi
            if (error.status === 401) {
              alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!');
            }
            return of(null);
          })
        )
        .subscribe();
    } else {
      // Thêm sản phẩm mới - kiểm tra giới hạn 100 sản phẩm khác nhau
      // Đếm số items purchased (không tính gifted)
      const purchasedItemsCount = this.cartItems().filter((i) => i.itemType !== 'gifted').length;
      if (purchasedItemsCount >= 100) {
        // Hiển thị toast màu đỏ cảnh báo giới hạn
        this.toastService.show(
          'Giỏ hàng đã đạt giới hạn tối đa 100 sản phẩm. Vui lòng xóa bớt sản phẩm trong giỏ hàng!',
          'error'
        );
        return;
      }

      const newItem = {
        ...item,
        quantity: 1,
        selected: true,
      };

      // Tách items thành purchased/gifted nếu có buy1get1
      const expandedItems = this.expandBuy1Get1Items([newItem]);

      // Thêm vào frontend
      this.cartItems.set([...expandedItems, ...this.cartItems()]);

      // Hiển thị toast notification nếu được bật
      if (showToast) {
        this.toastService.show('Đã thêm vào giỏ hàng!');
      }

      // Add to backend (chỉ add item purchased, không add gifted)
      const purchasedItem = expandedItems.find((i) => i.itemType === 'purchased') || newItem;
      const backendItem = this.mapToBackendItem(purchasedItem);
      console.log(' [CartService] Adding to cart:', backendItem);

      this.http
        .post<any>(`${this.apiUrl}/${customerID}/add`, backendItem)
        .pipe(
          tap((response) => {
            console.log(' [CartService] Item added to backend:', response);
          }),
          catchError((error) => {
            console.error(' [CartService] Error adding to backend:', error);
            return of(null);
          })
        )
        .subscribe();
    }
  }

  removeFromCart(itemId: number) {
    const customerID = this.getCustomerID();
    const item = this.cartItems().find((item) => item.id === itemId);

    if (!item) return;

    // Remove from frontend (xóa cả item purchased và item gifted tương ứng)
    const itemSku = item.sku;
    const updatedItems = this.cartItems().filter((cartItem) => {
      // Nếu có SKU, xóa cả purchased và gifted cùng SKU
      if (itemSku && cartItem.sku) {
        return cartItem.sku !== itemSku;
      }
      // Nếu không có SKU, chỉ xóa item có cùng id
      return cartItem.id !== itemId;
    });
    this.cartItems.set(updatedItems);

    // Nếu sau khi xóa không còn items nào, clear cart
    if (updatedItems.length === 0) {
      console.log(' [CartService] Cart is empty after removal, clearing cart');
      this.clearCart().subscribe({
        next: () => {
          console.log(' [CartService] Cart cleared after removing last item');
        },
        error: (error) => {
          console.error(' [CartService] Error clearing empty cart:', error);
        },
      });
      return;
    }

    // Remove from backend
    const sku = item.sku || itemId.toString();
    this.http
      .delete<any>(`${this.apiUrl}/${customerID}/remove/${sku}`)
      .pipe(
        tap((response) => {
          console.log(' [CartService] Item removed from backend:', response);
        }),
        catchError((error) => {
          console.error(' [CartService] Error removing from backend:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  updateQuantity(itemId: number, quantity: number) {
    if (quantity <= 0) {
      this.removeFromCart(itemId);
      return;
    }

    const customerID = this.getCustomerID();
    const item = this.cartItems().find((item) => item.id === itemId);

    if (!item) return;

    // Update frontend (cập nhật cả item purchased và item gifted tương ứng)
    const itemSku = item.sku;
    const updatedItems = this.cartItems().map((cartItem) => {
      // Nếu có SKU, cập nhật cả purchased và gifted cùng SKU
      if (itemSku && cartItem.sku === itemSku) {
        return { ...cartItem, quantity: quantity };
      }
      // Nếu không có SKU, chỉ cập nhật item có cùng id
      if (cartItem.id === itemId) {
        return { ...cartItem, quantity: quantity };
      }
      return cartItem;
    });
    this.cartItems.set(updatedItems);

    // Update backend
    const sku = item.sku || itemId.toString();
    this.http
      .put<any>(`${this.apiUrl}/${customerID}/update/${sku}`, { quantity })
      .pipe(
        tap((response) => {
          console.log(' [CartService] Quantity updated in backend:', response);
        }),
        catchError((error) => {
          console.error(' [CartService] Error updating quantity in backend:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  toggleItemSelection(itemId: number) {
    const item = this.cartItems().find((item) => item.id === itemId);
    if (!item) return;

    const newSelectedState = !item.selected;
    const itemSku = item.sku;

    // Cập nhật items: nếu là purchased item, cũng cập nhật gifted item tương ứng
    const updatedItems = this.cartItems().map((cartItem) => {
      // Nếu có SKU, cập nhật cả purchased và gifted cùng SKU
      if (itemSku && cartItem.sku === itemSku) {
        return { ...cartItem, selected: newSelectedState };
      }
      // Nếu không có SKU, chỉ cập nhật item có cùng id
      if (cartItem.id === itemId) {
        return { ...cartItem, selected: newSelectedState };
      }
      return cartItem;
    });

    this.cartItems.set(updatedItems);
    console.log(
      `[CartService] Toggled selection for item ${itemId} (SKU: ${itemSku}), new state: ${newSelectedState}`
    );
  }

  // Promotion management
  setPromotion(promotion: any, discountAmount: number, finalAmount: number) {
    this.selectedPromotion.set(promotion);
    this.discountAmount.set(discountAmount);
    this.finalAmount.set(finalAmount);
  }

  clearPromotion() {
    this.selectedPromotion.set(null);
    this.discountAmount.set(0);
    this.finalAmount.set(0);
  }

  // Xóa một item khỏi cart
  removeItem(itemId: number) {
    const customerID = this.getCustomerID();
    const item = this.cartItems().find((item) => item.id === itemId);

    if (!item) return;

    // Remove from frontend
    const currentItems = this.cartItems();
    const updatedItems = currentItems.filter((item) => item.id !== itemId);
    this.cartItems.set(updatedItems);
    console.log(`Removed item ${itemId} from cart. Remaining items:`, updatedItems.length);

    // Nếu sau khi xóa không còn items nào, clear cart
    if (updatedItems.length === 0) {
      console.log(' [CartService] Cart is empty after removal, clearing cart');
      this.clearCart().subscribe({
        next: () => {
          console.log(' [CartService] Cart cleared after removing last item');
        },
        error: (error) => {
          console.error(' [CartService] Error clearing empty cart:', error);
        },
      });
      return;
    }

    // Remove from backend
    const sku = item.sku || itemId.toString();
    this.http
      .delete<any>(`${this.apiUrl}/${customerID}/remove/${sku}`)
      .pipe(
        tap((response) => {
          console.log(' [CartService] Item removed from backend:', response);
        }),
        catchError((error) => {
          console.error(' [CartService] Error removing from backend:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  // Toggle select all items (chỉ toggle purchased items, gifted items tự động theo)
  toggleSelectAll() {
    const currentItems = this.cartItems();
    const purchasedItems = currentItems.filter((item) => item.itemType !== 'gifted');
    const allPurchasedSelected =
      purchasedItems.length > 0 && purchasedItems.every((item) => item.selected);
    const newSelectedState = !allPurchasedSelected;

    // Tạo map để track SKU và selected state
    const skuSelectedMap = new Map<string, boolean>();

    // Cập nhật purchased items và lưu selected state theo SKU
    const updatedItems = currentItems.map((item) => {
      if (item.itemType !== 'gifted') {
        // Purchased item: set selected state mới
        const newState = newSelectedState;
        if (item.sku) {
          skuSelectedMap.set(item.sku, newState);
        }
        return { ...item, selected: newState };
      } else {
        // Gifted item: set selected state theo purchased item cùng SKU
        if (item.sku && skuSelectedMap.has(item.sku)) {
          return { ...item, selected: skuSelectedMap.get(item.sku)! };
        }
        // Nếu không có SKU hoặc không tìm thấy purchased item, giữ nguyên
        return item;
      }
    });

    this.cartItems.set(updatedItems);
    console.log(
      `[CartService] Toggle select all: ${newSelectedState ? 'Select all' : 'Deselect all'}`
    );
  }

  // Deselect all items (for repurchase functionality)
  deselectAllItems() {
    const currentItems = this.cartItems();
    const updatedItems = currentItems.map((item) => ({
      ...item,
      selected: false,
    }));
    this.cartItems.set(updatedItems);
    console.log(' [CartService] Deselected all items');
  }

  // Add or update item with specific quantity (for repurchase functionality)
  addOrUpdateItemWithQuantity(item: any, targetQuantity: number, showToast: boolean = false) {
    const customerID = this.getCustomerID();

    // Kiểm tra xem user đã đăng nhập chưa
    if (customerID === 'guest') {
      console.warn(' [CartService] Guest user cannot add to cart - login required');
      alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!');
      return;
    }

    // So sánh bằng cả id và sku để đảm bảo tìm đúng sản phẩm
    const existingItem = this.cartItems().find((cartItem) => {
      // So sánh bằng sku trước (nếu có)
      if (cartItem.sku && item.sku) {
        return cartItem.sku === item.sku;
      }
      // Nếu không có sku, so sánh bằng id
      const cartItemId = typeof cartItem.id === 'string' ? parseInt(cartItem.id) : cartItem.id;
      const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
      return cartItemId === itemId;
    });

    if (existingItem) {
      // Cập nhật số lượng theo targetQuantity và đưa lên đầu danh sách
      const updatedItem = { ...existingItem, quantity: targetQuantity, selected: true };

      // Lọc ra các item khác (bao gồm cả gifted item nếu có)
      const otherItems = this.cartItems().filter((cartItem) => {
        // Bỏ qua cả item purchased và item gifted tương ứng (cùng SKU)
        if (cartItem.sku && item.sku) {
          return cartItem.sku !== item.sku;
        }
        const cartItemId = typeof cartItem.id === 'string' ? parseInt(cartItem.id) : cartItem.id;
        const itemId = typeof item.id === 'string' ? parseInt(item.id) : item.id;
        return cartItemId !== itemId;
      });

      // Tách items thành purchased/gifted nếu có buy1get1
      const expandedItems = this.expandBuy1Get1Items([updatedItem]);

      // Đưa sản phẩm đã cập nhật lên đầu danh sách
      this.cartItems.set([...expandedItems, ...otherItems]);

      // Update backend (chỉ update item purchased, không update gifted)
      const purchasedItem = expandedItems.find((i) => i.itemType === 'purchased') || updatedItem;
      const backendItem = this.mapToBackendItem({ ...purchasedItem, quantity: targetQuantity });
      this.http
        .put<any>(`${this.apiUrl}/${customerID}/update/${backendItem.sku}`, {
          quantity: targetQuantity,
        })
        .pipe(
          tap((response) => {
            console.log(' [CartService] Item quantity updated in backend:', response);
          }),
          catchError((error) => {
            console.error(' [CartService] Error updating quantity in backend:', error);
            return of(null);
          })
        )
        .subscribe();
    } else {
      // Thêm sản phẩm mới với số lượng cụ thể
      if (this.cartItems().length >= 100) {
        this.toastService.show(
          'Giỏ hàng đã đạt giới hạn tối đa 100 sản phẩm. Vui lòng xóa bớt sản phẩm trong giỏ hàng!',
          'error'
        );
        return;
      }

      const newItem = {
        ...item,
        quantity: targetQuantity,
        selected: true,
      };

      // Thêm vào frontend
      this.cartItems.set([newItem, ...this.cartItems()]);

      // Add to backend
      const backendItem = this.mapToBackendItem(newItem);
      console.log(' [CartService] Adding to cart:', backendItem);

      this.http
        .post<any>(`${this.apiUrl}/${customerID}/add`, backendItem)
        .pipe(
          tap((response) => {
            console.log(' [CartService] Item added to backend:', response);
          }),
          catchError((error) => {
            console.error(' [CartService] Error adding to backend:', error);
            return of(null);
          })
        )
        .subscribe();
    }
  }

  // Clear entire cart
  clearCart(): Observable<any> {
    const customerID = this.getCustomerID();
    console.log(' [CartService] Clearing cart for:', customerID);

    // Clear frontend state immediately
    this.cartItems.set([]);
    this.clearPromotion();

    // Return Observable để caller có thể subscribe
    return this.http.delete<any>(`${this.apiUrl}/${customerID}/clear`).pipe(
      tap((response) => {
        console.log(' [CartService] Cart cleared in backend:', response);
      }),
      catchError((error) => {
        console.error(' [CartService] Error clearing cart in backend:', error);
        return of(null);
      })
    );
  }

  // Remove multiple items from cart (used after order placement or delete selected)
  removeMultipleItems(skus: string[]): Observable<any> {
    const customerID = this.getCustomerID();
    console.log(' [CartService] Removing multiple items:', skus);

    // Remove from frontend state
    const currentItems = this.cartItems();
    const updatedItems = currentItems.filter((item) => !skus.includes(item.sku));
    this.cartItems.set(updatedItems);

    // Nếu sau khi xóa không còn items nào, clear cart thay vì gọi remove-multiple
    if (updatedItems.length === 0) {
      console.log(' [CartService] Cart will be empty after removal, using clearCart');
      return this.clearCart();
    }

    // Call backend API
    return this.http.post<any>(`${this.apiUrl}/${customerID}/remove-multiple`, { skus }).pipe(
      tap((response) => {
        console.log(` [CartService] Removed ${response.removedCount} items from backend`);
        // Update cart counts from backend response
        if (response.data) {
          this.loadCart();
        }
      }),
      catchError((error) => {
        console.error(' [CartService] Error removing items from backend:', error);
        // Keep frontend state even if backend fails
        return of(null);
      })
    );
  }

  // Sync cart to backend (useful after login)
  syncCart() {
    const customerID = this.getCustomerID();
    // Chỉ sync items purchased (không sync items gifted)
    const purchasedItems = this.cartItems()
      .filter((item) => item.itemType !== 'gifted')
      .map((item) => this.mapToBackendItem(item));

    console.log(' [CartService] Syncing cart to backend:', purchasedItems.length, 'items');

    this.http
      .post<any>(`${this.apiUrl}/${customerID}/sync`, { items: purchasedItems })
      .pipe(
        tap((response) => {
          console.log(' [CartService] Cart synced to backend:', response);
        }),
        catchError((error) => {
          console.error(' [CartService] Error syncing cart:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  // Load promotions và targets để check buy1get1
  private loadPromotionsAndTargets(): void {
    const apiUrl = 'http://localhost:3000/api';
    this.http
      .get<any>(`${apiUrl}/promotions`)
      .pipe(
        tap((promotionsResponse) => {
          // Filter active promotions
          const now = new Date();
          const activePromotions = (promotionsResponse.data || []).filter((p: any) => {
            const startDate = new Date(p.start_date);
            const endDate = new Date(p.end_date);
            return p.status === 'Active' && now >= startDate && now <= endDate;
          });
          this.promotions = activePromotions;
          console.log('✅ [CartService] Loaded promotions:', this.promotions.length);
        }),
        catchError((error) => {
          console.error('❌ [CartService] Error loading promotions:', error);
          return of(null);
        })
      )
      .subscribe();

    this.http
      .get<any>(`${apiUrl}/promotion-targets`)
      .pipe(
        tap((targetsResponse) => {
          this.promotionTargets = targetsResponse?.data || [];
          console.log('✅ [CartService] Loaded promotion targets:', this.promotionTargets.length);
        }),
        catchError((error) => {
          console.error('❌ [CartService] Error loading promotion targets:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  // Tách items thành purchased/gifted nếu có buy1get1
  private expandBuy1Get1Items(items: any[]): any[] {
    const expandedItems: any[] = [];

    items.forEach((item) => {
      // Bỏ qua items đã là gifted (tránh tách lại)
      if (item.itemType === 'gifted') {
        console.log(`[CartService] Skipping gifted item: SKU=${item.sku}`);
        return;
      }

      // Check buy1get1
      const hasBuy1Get1 = this.checkBuy1Get1Promotion(item);
      console.log(`[CartService] Item SKU=${item.sku}, hasBuy1Get1=${hasBuy1Get1}`);

      if (hasBuy1Get1) {
        // Item mua
        const purchasedItem = {
          ...item,
          hasBuy1Get1: true,
          itemType: 'purchased' as const,
        };
        expandedItems.push(purchasedItem);
        console.log(
          `[CartService] Added purchased item: SKU=${purchasedItem.sku}, itemType=${purchasedItem.itemType}`
        );

        // Item tặng kèm - selected state luôn giống purchased item
        const giftedItem = {
          ...item,
          hasBuy1Get1: true,
          itemType: 'gifted' as const,
          price: 0, // Giá = 0 (miễn phí)
          selected: item.selected, // Giữ selected state giống purchased item
        };
        expandedItems.push(giftedItem);
        console.log(
          `[CartService] Added gifted item: SKU=${giftedItem.sku}, itemType=${giftedItem.itemType}`
        );
      } else {
        // Item bình thường (không có buy1get1)
        const normalItem = {
          ...item,
          hasBuy1Get1: false,
          itemType: 'purchased' as const,
        };
        expandedItems.push(normalItem);
        console.log(
          `[CartService] Added normal item: SKU=${normalItem.sku}, itemType=${normalItem.itemType}`
        );
      }
    });

    console.log(
      `[CartService] Expanded items count: ${expandedItems.length}, purchased: ${
        expandedItems.filter((i) => i.itemType === 'purchased').length
      }, gifted: ${expandedItems.filter((i) => i.itemType === 'gifted').length}`
    );
    return expandedItems;
  }

  // Kiểm tra xem sản phẩm có khuyến mãi buy1get1 không
  private checkBuy1Get1Promotion(item: any): boolean {
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
  private isProductMatchTarget(item: any, target: any): boolean {
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

      case 'Subcategory':
        // Match theo subcategory
        return targetRefs.some((ref: string) => {
          const refSubcategory = ref.trim().toLowerCase();
          return refSubcategory === item.subcategory?.toLowerCase();
        });

      default:
        return false;
    }
  }
}
