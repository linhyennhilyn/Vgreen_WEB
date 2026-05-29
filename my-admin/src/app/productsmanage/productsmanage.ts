import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';

/**
 * ============================================================================
 * INTERFACES & TYPES
 * ============================================================================
 */

/**
 * Product JSON structure from data file
 */
interface ProductJSON {
  _id: string;
  category: string;
  subcategory: string;
  product_name: string;
  brand: string;
  unit: string;
  price: number;
  image: string[] | string;
  sku: string;
  origin?: string;
  weight?: string;
  ingredients?: string;
  usage?: string;
  storage?: string;
  manufacture_date?: string;
  expiry_date?: string;
  producer?: string;
  safety_warning?: string;
  responsible_org?: string;
  color?: any;
  base_price?: number;
  rating?: number;
  purchase_count?: number;
  status?: string;
  post_date?: any;
  liked?: number;
  groups?: string[]; // Product groups
}

/**
 * Product interface for application use
 */
export interface Product {
  id?: number;
  _id?: string | any; // MongoDB _id field
  name: string;
  code: string;
  sku?: string;
  brand?: string;
  category: string;
  subcategory?: string;
  color?: string;
  stock: number;
  unit: string;
  originalPrice?: number;
  price: number;
  salePrice?: number;
  images?: string[];
  image?: string;
  rating?: number;
  updated?: string;
  selected?: boolean;
  origin?: string;
  weight?: string;
  ingredients?: string;
  usage?: string;
  storage?: string;
  producer?: string;
  manufactureDate?: string;
  expiryDate?: string;
  safetyWarning?: string;
  responsibleOrg?: string;
  groups?: string[]; // Danh sách các nhóm mà sản phẩm thuộc về
  PurchaseCount?: number; // Số lượt mua
  liked?: number; // Số lượt like
  reviewCount?: number; // Số lượt đánh giá
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Filter criteria interface
 */
export interface FilterCriteria {
  category?: string;
  subcategory?: string;
  stockStatus?: 'in-stock' | 'out-of-stock' | 'low-stock';
  minPrice?: number;
  maxPrice?: number;
  rating?: number; // Exact rating, not minimum
  group?: string;
}

/**
 * ============================================================================
 * HELPER FUNCTIONS (Business Logic)
 * ============================================================================
 */

/**
 * Map ProductJSON from data file to Product interface
 */
function mapProductFromJSON(json: ProductJSON, index: number): Product {
  // Handle image field - can be array or string
  let imageUrl = '';
  let imageArray: string[] = [];

  if (Array.isArray(json.image)) {
    imageArray = json.image;
    imageUrl = json.image[0] || '';
  } else if (typeof json.image === 'string') {
    imageUrl = json.image;
    imageArray = [json.image];
  }

  // Handle post_date - can be Date object from MongoDB or { $date: ... } from JSON
  let updatedDate = '';
  if (json.post_date) {
    if (json.post_date instanceof Date) {
      // MongoDB Date object
      updatedDate = parsePostDate(json.post_date);
    } else if (json.post_date.$date) {
      // JSON format with $date
      updatedDate = parsePostDate(json.post_date.$date);
    } else if (typeof json.post_date === 'string') {
      // ISO string
      updatedDate = parsePostDate(json.post_date);
    } else {
      updatedDate = parsePostDate(json.post_date);
    }
  }

  // Tính stock từ MongoDB - ưu tiên trường stock chính thức
  let stock = 0;
  const jsonAny = json as any;
  // Ưu tiên trường stock từ MongoDB (trường chính thức)
  if (jsonAny.stock !== undefined && jsonAny.stock !== null) {
    stock = Number(jsonAny.stock) || 0;
  } else if (jsonAny.quantity !== undefined && jsonAny.quantity !== null) {
    stock = Number(jsonAny.quantity) || 0;
  } else if (jsonAny.quantity_available !== undefined && jsonAny.quantity_available !== null) {
    stock = Number(jsonAny.quantity_available) || 0;
  } else if (jsonAny.Quantity !== undefined && jsonAny.Quantity !== null) {
    stock = Number(jsonAny.Quantity) || 0;
  } else {
    // Nếu không có trường stock, mặc định là 0 (không tính seed nữa để đảm bảo chính xác)
    stock = 0;
  }

  // Handle _id - can be ObjectId from MongoDB or string
  let productId = '';
  if (json._id) {
    // Convert ObjectId to string if needed
    if (typeof json._id === 'object' && json._id !== null) {
      // Handle MongoDB ObjectId or any object with toString
      const idObj = json._id as any;
      if (idObj.toString && typeof idObj.toString === 'function') {
        productId = idObj.toString();
      } else if (idObj.$oid) {
        // Handle MongoDB extended JSON format: { $oid: "..." }
        productId = idObj.$oid;
      } else if (idObj.value) {
        // Handle other object formats
        productId = String(idObj.value);
      } else {
        // Try to stringify the object
        productId = JSON.stringify(json._id);
      }
    } else {
      // It's already a string or primitive
      productId = String(json._id);
    }
  }

  // Ensure productId is not empty and is a valid string
  if (!productId || productId === 'null' || productId === 'undefined') {
    console.warn(`⚠️ Product ${index + 1} has invalid _id:`, json._id);
    // Try to use SKU as fallback
    productId = json.sku || `temp-${index}`;
  }

  // Debug logging for first few products
  if (index < 3) {
    console.log(`📦 Mapping product ${index + 1}:`, {
      original_id: json._id,
      original_id_type: typeof json._id,
      mapped_id: productId,
      name: json.product_name,
      sku: json.sku,
    });
  }

  return {
    id: index + 1,
    _id: productId, // MongoDB _id as string
    name: json.product_name || '',
    code: productId || '', // Use _id as product code
    sku: json.sku || undefined,
    brand: json.brand || '',
    category: json.category || '',
    subcategory: json.subcategory || '',
    color: json.color && typeof json.color === 'string' ? json.color : undefined,
    unit: json.unit || '',
    price: json.price || 0,
    originalPrice: json.base_price || json.price || 0,
    salePrice: 0,
    stock: stock, // Sử dụng stock đã tính toán nhất quán với dashboard
    rating: json.rating !== undefined && json.rating !== null ? json.rating : undefined, // Rating từ MongoDB, nếu không có thì undefined (sẽ tính từ reviews)
    image: imageUrl,
    images: imageArray,
    origin: json.origin,
    weight: json.weight,
    ingredients: json.ingredients,
    usage: json.usage,
    storage: json.storage,
    producer: json.producer,
    manufactureDate: json.manufacture_date,
    expiryDate: json.expiry_date,
    safetyWarning: json.safety_warning,
    responsibleOrg: json.responsible_org,
    updated: updatedDate,
    selected: false,
    groups: json.groups && Array.isArray(json.groups) ? json.groups : [], // Map groups from API
    PurchaseCount: json.purchase_count || 0, // Số lượt mua
    liked: json.liked || 0, // Số lượt like
    reviewCount: (json as any).reviewCount || 0, // Số lượt đánh giá
  };
}

/**
 * Select diverse products from different categories
 * @param products - All products from JSON
 * @param targetCount - Target number of products (default 100)
 * @returns Filtered products representing different categories
 */
function selectDiverseProducts(products: ProductJSON[], targetCount: number = 100): ProductJSON[] {
  // Group products by category and subcategory
  const grouped = new Map<string, ProductJSON[]>();

  products.forEach((product) => {
    const key = `${product.category}|${product.subcategory}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(product);
  });

  console.log(`Found ${grouped.size} unique category-subcategory combinations`);

  // Calculate products per group
  const groupCount = grouped.size;
  const productsPerGroup = Math.max(1, Math.floor(targetCount / groupCount));

  // Select products from each group
  const selectedProducts: ProductJSON[] = [];

  grouped.forEach((groupProducts, key) => {
    const [category, subcategory] = key.split('|');

    // Take first N products from this group
    const selected = groupProducts.slice(0, productsPerGroup);
    selectedProducts.push(...selected);

    console.log(
      `${category} > ${subcategory}: Selected ${selected.length} of ${groupProducts.length} products`
    );
  });

  // If we don't have enough, add more from larger groups
  if (selectedProducts.length < targetCount) {
    const remaining = targetCount - selectedProducts.length;
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

    let added = 0;
    let currentIndex = productsPerGroup; // Start from the next index after initial selection

    // Keep looping through groups until we have enough products
    while (added < remaining) {
      let addedInThisRound = 0;

      for (const [key, groupProducts] of sortedGroups) {
        if (added >= remaining) break;

        // Add one more product from this group if available at current index
        if (groupProducts.length > currentIndex) {
          selectedProducts.push(groupProducts[currentIndex]);
          added++;
          addedInThisRound++;
        }
      }

      // Move to next index for next round
      currentIndex++;

      // If no products were added in this round, we've exhausted all groups
      if (addedInThisRound === 0) break;
    }

    console.log(`Added ${added} more products to reach target`);
  }

  // Limit to target count
  const result = selectedProducts.slice(0, targetCount);
  console.log(`Final selection: ${result.length} products from ${grouped.size} categories`);

  return result;
}

/**
 * Get current date in DD-MM-YYYY format
 */
function getCurrentDate(): string {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parse post_date from MongoDB format and convert to DD-MM-YYYY
 */
function parsePostDate(postDate: any): string {
  if (!postDate) {
    return getCurrentDate();
  }

  try {
    let date: Date;

    // Handle MongoDB Date object
    if (postDate instanceof Date) {
      date = postDate;
    }
    // Handle MongoDB date format: { "$date": "2025-05-05T03:30:06.567Z" }
    else if (typeof postDate === 'object' && postDate.$date) {
      date = new Date(postDate.$date);
    }
    // Handle ISO string
    else if (typeof postDate === 'string') {
      date = new Date(postDate);
    }
    // Handle other object formats
    else {
      date = new Date(postDate);
    }

    // Check if valid date
    if (isNaN(date.getTime())) {
      return getCurrentDate();
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error parsing post_date:', error);
    return getCurrentDate();
  }
}

/**
 * Get next product ID
 */
function getNextProductId(products: Product[]): number {
  if (products.length === 0) return 1;
  const maxId = Math.max(...products.map((p) => p.id || 0));
  return maxId + 1;
}

/**
 * Create empty product object
 */
function createEmptyProduct(): Product {
  return {
    name: '',
    code: '',
    sku: '',
    brand: '',
    category: '',
    color: '',
    stock: 0,
    unit: '',
    originalPrice: 0,
    price: 0,
    salePrice: 0,
    images: [],
    groups: [],
    rating: undefined, // Rating rỗng khi tạo sản phẩm mới, sẽ được tính từ reviews
  };
}

/**
 * Count selected products
 */
function countSelectedProducts(products: Product[]): number {
  return products.filter((p) => p.selected).length;
}

/**
 * Get selected products
 */
function getSelectedProducts(products: Product[]): Product[] {
  return products.filter((p) => p.selected);
}

/**
 * Validate product data
 */
function validateProduct(product: Product): ValidationResult {
  const errors: string[] = [];

  if (!product.name || product.name.trim() === '') {
    errors.push('Tên sản phẩm không được để trống');
  }

  if (!product.code || product.code.trim() === '') {
    errors.push('Mã sản phẩm không được để trống');
  }

  if (!product.category || product.category.trim() === '') {
    errors.push('Danh mục không được để trống');
  }

  if (product.price < 0) {
    errors.push('Giá bán phải lớn hơn hoặc bằng 0');
  }

  if (product.stock < 0) {
    errors.push('Số lượng tồn kho phải lớn hơn hoặc bằng 0');
  }

  if (product.salePrice && product.salePrice > 0 && product.salePrice >= product.price) {
    errors.push('Giá khuyến mãi phải nhỏ hơn giá bán');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Save product (add new or update existing)
 */
function saveProductData(
  products: Product[],
  currentProduct: Product,
  isEditing: boolean
): Product[] {
  if (isEditing) {
    // Update existing product
    return products.map((p) =>
      p.id === currentProduct.id ? { ...currentProduct, updated: getCurrentDate() } : p
    );
  } else {
    // Add new product
    const newProduct: Product = {
      ...currentProduct,
      id: getNextProductId(products),
      rating: 0,
      updated: getCurrentDate(),
      selected: false,
    };
    return [...products, newProduct];
  }
}

/**
 * Delete selected products
 */
function deleteSelectedProducts(products: Product[]): Product[] {
  return products.filter((p) => !p.selected);
}

/**
 * Search products by query
 */
function searchProductsByQuery(products: Product[], query: string): Product[] {
  if (!query || query.trim() === '') {
    return products;
  }

  const searchTerm = query.toLowerCase().trim();

  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(searchTerm) ||
      product.code.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      (product.brand && product.brand.toLowerCase().includes(searchTerm)) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm))
    );
  });
}

/**
 * Filter products by criteria
 */
function filterProductsByCriteria(products: Product[], filters: FilterCriteria): Product[] {
  let filtered = [...products];

  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter((p) => p.category === filters.category);
  }

  if (filters.subcategory && filters.subcategory !== 'all') {
    filtered = filtered.filter((p) => p.subcategory === filters.subcategory);
  }

  if (filters.stockStatus) {
    if (filters.stockStatus === 'in-stock') {
      filtered = filtered.filter((p) => p.stock > 0);
    } else if (filters.stockStatus === 'out-of-stock') {
      filtered = filtered.filter((p) => p.stock === 0);
    } else if (filters.stockStatus === 'low-stock') {
      filtered = filtered.filter((p) => p.stock > 0 && p.stock < 10);
    }
  }

  if (filters.minPrice !== undefined && filters.minPrice !== null) {
    filtered = filtered.filter((p) => p.price >= filters.minPrice!);
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
    filtered = filtered.filter((p) => p.price <= filters.maxPrice!);
  }

  if (filters.rating !== undefined && filters.rating !== null) {
    const selectedRating = filters.rating;
    filtered = filtered.filter((p) => {
      const rating = p.rating || 0;
      // Chọn 5 sao: chỉ hiện 5 sao (rating >= 5.0)
      if (selectedRating === 5) {
        return rating >= 5.0;
      }
      // Chọn 4 sao: hiện 4 sao và 4.5 sao (rating >= 4.0 và < 5.0)
      if (selectedRating === 4) {
        return rating >= 4.0 && rating < 5.0;
      }
      // Chọn 3 sao: hiện 3 sao và 3.5 sao (rating >= 3.0 và < 4.0)
      if (selectedRating === 3) {
        return rating >= 3.0 && rating < 4.0;
      }
      // Chọn 2 sao: hiện 2 sao và 2.5 sao (rating >= 2.0 và < 3.0)
      if (selectedRating === 2) {
        return rating >= 2.0 && rating < 3.0;
      }
      // Chọn 1 sao: hiện 1 sao và 1.5 sao (rating >= 1.0 và < 2.0)
      if (selectedRating === 1) {
        return rating >= 1.0 && rating < 2.0;
      }
      return false;
    });
  }

  if (filters.group && filters.group !== 'all') {
    filtered = filtered.filter((p) => p.groups && p.groups.includes(filters.group!));
  }

  return filtered;
}

/**
 * Parse date string from DD-MM-YYYY to Date object for comparison
 */
function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date(0); // Return epoch for invalid dates

  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(0);

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);

  return new Date(year, month, day);
}

/**
 * Sort products by field
 */
function sortProductsByField(
  products: Product[],
  field: keyof Product,
  order: 'asc' | 'desc' = 'asc'
): Product[] {
  const sorted = [...products].sort((a, b) => {
    let aVal: any = a[field];
    let bVal: any = b[field];

    // Special handling for 'updated' field (date string DD-MM-YYYY)
    if (field === 'updated' && typeof aVal === 'string' && typeof bVal === 'string') {
      const aDate = parseDateString(aVal);
      const bDate = parseDateString(bVal);

      if (aDate < bDate) return order === 'asc' ? -1 : 1;
      if (aDate > bDate) return order === 'asc' ? 1 : -1;
      return 0;
    }

    // Special handling for 'name' field - use Vietnamese alphabetical order
    if (field === 'name' && typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal, 'vi', { sensitivity: 'base' });
      return order === 'asc' ? comparison : -comparison;
    }

    // Handle string comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Get stock status class for styling
 */
function getStockClass(stock: number): string {
  if (stock === 0) return 'stock-out';
  if (stock < 10) return 'stock-low';
  return 'stock-high';
}

/**
 * Get stock status text
 */
function getStockStatus(stock: number): string {
  if (stock === 0) return 'Hết hàng';
  if (stock < 10) return 'Sắp hết';
  return 'Còn hàng';
}

/**
 * Star type for display
 */
export type StarType = 'full' | 'half' | 'empty';

/**
 * Get star rating array for display with half star support
 */
function getStarArray(rating: number | undefined): StarType[] {
  const safeRating = rating || 0;
  const fullStars = Math.floor(safeRating);
  const hasHalfStar = safeRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const stars: StarType[] = [];

  // Add full stars
  for (let i = 0; i < fullStars; i++) {
    stars.push('full');
  }

  // Add half star if applicable
  if (hasHalfStar) {
    stars.push('half');
  }

  // Add empty stars
  for (let i = 0; i < emptyStars; i++) {
    stars.push('empty');
  }

  return stars;
}

/**
 * Calculate discount percentage
 */
function calculateDiscountPercentage(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/**
 * Format currency (VND)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Process image file selection
 */
function processImageFile(file: File, index: number) {
  if (!file) return null;

  return {
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    index,
    preview: URL.createObjectURL(file),
  };
}

/**
 * Export products to CSV
 */
function exportProductsToCSV(products: Product[]): string {
  const headers = [
    'ID',
    'Tên',
    'Mã',
    'SKU',
    'Thương hiệu',
    'Danh mục',
    'Tồn kho',
    'Đơn vị',
    'Giá gốc',
    'Giá bán',
    'Giá KM',
    'Đánh giá',
    'Cập nhật',
  ];

  const rows = products.map((p) => [
    p.id || '',
    p.name,
    p.code,
    p.sku || '',
    p.brand || '',
    p.category,
    p.stock,
    p.unit,
    p.originalPrice || 0,
    p.price,
    p.salePrice || 0,
    p.rating || 0,
    p.updated || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * ============================================================================
 * ANGULAR COMPONENT
 * ============================================================================
 */

@Component({
  selector: 'app-productsmanage',
  imports: [CommonModule, FormsModule],
  templateUrl: './productsmanage.html',
  styleUrl: './productsmanage.css',
  standalone: true,
})
export class ProductsManage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  // Subscription để cleanup
  private queryParamsSubscription?: Subscription;

  showProductForm = false;
  isSidebarCollapsed = false; // Track sidebar state
  editingProduct = false;
  currentProduct: Product = createEmptyProduct();
  originalProduct: Product | null = null; // Lưu bản sao ban đầu để revert khi hủy

  // Products data loaded from JSON
  products: Product[] = [];
  allProducts: Product[] = []; // Keep original data for search/filter
  filteredProducts: Product[] = []; // After filter/sort

  // Loading state
  isLoading = false;
  loadError = '';

  selectedCount = 0;
  selectAll = false;

  // Filter & Sort state
  showFilterModal = false;
  showFilterDropdown = false;
  showSortDropdown = false;
  currentSortField: keyof Product = 'updated';
  currentSortOrder: 'asc' | 'desc' = 'desc';
  currentFilters: FilterCriteria = {};

  // Popup notification
  showPopup: boolean = false;
  popupMessage: string = '';
  popupType: 'success' | 'error' | 'info' = 'success';

  // Confirmation dialog
  showConfirmDialog: boolean = false;
  confirmMessage: string = '';
  confirmCallback: (() => void) | null = null;

  // Order warning dialog (for products in pending orders)
  showOrderWarningDialog: boolean = false;
  orderWarningMessage: string = '';
  affectedOrders: any[] = [];
  pendingDeleteProducts: { productId: string; productName: string }[] = [];
  orderWarningCallback: (() => void) | null = null;

  // Available filter options
  availableCategories: string[] = [];
  availableSubcategories: string[] = [];

  // For form dropdowns
  formSubcategories: string[] = []; // Subcategories for selected category in form
  availableColors: string[] = []; // Available colors from products

  // Group management
  showGroupModal = false;
  newGroupName = '';
  selectedGroupToAdd = ''; // For selecting existing group from dropdown
  allGroupNames: string[] = []; // All unique group names in the system

  // Auto-save with debounce
  private autoSaveTimer: any = null;
  private readonly AUTO_SAVE_DELAY = 1000; // 1 second debounce

  // Map frontend field names to backend field names
  private readonly fieldMapping: { [key: string]: string } = {
    name: 'product_name',
    code: '_id',
    sku: 'sku',
    brand: 'brand',
    category: 'category',
    subcategory: 'subcategory',
    origin: 'origin',
    weight: 'weight',
    unit: 'unit',
    stock: 'stock',
    ingredients: 'ingredients',
    usage: 'usage',
    storage: 'storage',
    color: 'color',
    producer: 'producer',
    responsibleOrg: 'responsible_org',
    manufactureDate: 'manufacture_date',
    expiryDate: 'expiry_date',
    safetyWarning: 'safety_warning',
    price: 'price',
    originalPrice: 'base_price',
  };

  /**
   * Angular lifecycle hook - runs when component initializes
   */
  ngOnInit(): void {
    // Đóng tất cả dropdowns khi component init
    this.showFilterDropdown = false;
    this.showSortDropdown = false;

    // Đọc query params ban đầu để set filter nếu có
    this.handleQueryParams(this.route.snapshot.queryParams);

    // Subscribe vào query params để lắng nghe thay đổi (khi navigate với query params mới)
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.handleQueryParams(params);
    });

    this.loadProducts();
    this.extractAllGroupNames();

    // Monitor sidebar state changes
    this.checkSidebarState();

    // Use MutationObserver for better performance
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const observer = new MutationObserver(() => {
        this.checkSidebarState();
      });
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  }

  /**
   * Handle query params changes
   */
  private handleQueryParams(params: any): void {
    // Check for 'filter' query param (from layout notification)
    if (params['filter'] === 'out-of-stock') {
      this.currentFilters.stockStatus = 'out-of-stock';
      // Apply filters ngay lập tức nếu products đã được load
      if (this.allProducts.length > 0) {
        this.updateProductsList();
      }
    } else if (params['stockStatus']) {
      // Legacy support for 'stockStatus' query param
      const stockStatus = params['stockStatus'] as 'in-stock' | 'out-of-stock' | 'low-stock';
      if (
        stockStatus === 'low-stock' ||
        stockStatus === 'out-of-stock' ||
        stockStatus === 'in-stock'
      ) {
        this.currentFilters.stockStatus = stockStatus;
        // Apply filters ngay lập tức nếu products đã được load
        if (this.allProducts.length > 0) {
          this.updateProductsList();
        }
      }
    } else if (!params['filter'] && !params['stockStatus']) {
      // Nếu không có query params, clear filter (nếu đang filter theo stockStatus)
      // Chỉ clear nếu đang filter theo stockStatus để tránh mất các filter khác
      if (this.currentFilters.stockStatus) {
        this.currentFilters.stockStatus = undefined;
        // Apply filters ngay lập tức nếu products đã được load
        if (this.allProducts.length > 0) {
          this.updateProductsList();
        }
      }
    }
  }

  ngOnDestroy(): void {
    // Cleanup subscription
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  /**
   * Check sidebar collapsed state
   */
  checkSidebarState(): void {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      this.isSidebarCollapsed = sidebar.classList.contains('collapsed');
    }
  }

  /**
   * Load products from MongoDB API or JSON file
   */
  loadProducts(): void {
    this.isLoading = true;
    this.loadError = '';

    console.log('🔄 Loading products from MongoDB API...');
    // Try MongoDB API first
    this.apiService.getProducts().subscribe({
      next: (data) => {
        console.log(`✅ Loaded ${data.length} products from MongoDB`);
        console.log('📦 Sample product from API:', data[0]);
        console.log('📦 Sample product _id type:', typeof data[0]?._id, data[0]?._id);

        // Check if product with SKU 3422157 exists in API response
        const targetProduct = data.find((item: any) => item.sku === '3422157');
        if (targetProduct) {
          console.log('🔍 [Load Products] Found product SKU 3422157 in API response:', {
            sku: targetProduct.sku,
            product_name: targetProduct.product_name,
            status: targetProduct.status,
            stock: targetProduct.stock,
            _id: targetProduct._id,
          });
        } else {
          console.warn('⚠️ [Load Products] Product SKU 3422157 NOT found in API response');
          console.log(
            '📋 [Load Products] Sample SKUs from API:',
            data.slice(0, 5).map((p: any) => p.sku)
          );
        }

        // Map API data to Product interface
        this.allProducts = data.map((item: any, index: number) => {
          const mapped = mapProductFromJSON(item, index);

          // Ensure _id is set correctly
          if (!mapped._id && item._id) {
            mapped._id = String(item._id);
            mapped.code = mapped._id;
          }

          // Log first 3 products for debugging
          if (index < 3) {
            console.log(`📦 Mapped product ${index + 1}:`, {
              original_id: item._id,
              mapped_id: mapped._id,
              mapped_code: mapped.code,
              name: mapped.name,
              sku: mapped.sku,
              purchase_count: item.purchase_count,
              liked: item.liked,
              reviewCount: item.reviewCount,
              PurchaseCount: mapped.PurchaseCount,
              liked_mapped: mapped.liked,
              reviewCount_mapped: mapped.reviewCount,
            });
          }

          return mapped;
        });

        console.log(`📊 Mapped ${this.allProducts.length} products`);
        console.log('📦 Sample mapped product:', this.allProducts[0]);

        // Verify _id is set for all products
        const productsWithoutId = this.allProducts.filter(
          (p) => !p._id || p._id === 'undefined' || p._id === 'null'
        );
        if (productsWithoutId.length > 0) {
          console.warn(
            `⚠️ Found ${productsWithoutId.length} products without valid _id:`,
            productsWithoutId.slice(0, 3)
          );
        }

        // Extract unique categories for filter
        this.extractCategories();

        // Calculate ratings from reviews for products that don't have rating
        this.calculateRatingsFromReviews();

        // Apply default sort (by updated date, descending)
        this.updateProductsList();

        // Reset selection state
        this.selectedCount = 0;
        this.selectAll = false;
        this.updateSelectedCount();

        this.isLoading = false;
        console.log('✅ Products loaded successfully:', this.products.length);

        // Extract group names
        this.extractAllGroupNames();

        // Log category distribution
        const categoryCount = new Map<string, number>();
        this.products.forEach((p) => {
          const key = `${p.category} > ${p.subcategory}`;
          categoryCount.set(key, (categoryCount.get(key) || 0) + 1);
        });
        console.log('Category distribution:', Array.from(categoryCount.entries()));
        console.log('Available categories:', this.availableCategories);
      },
      error: (error) => {
        console.error('❌ Error loading products from MongoDB:', error);
        this.loadError = '❌ Không thể tải dữ liệu từ MongoDB';
        this.isLoading = false;
        // Don't fallback to JSON - only use MongoDB data
        this.allProducts = [];
        this.products = [];
      },
    });
  }

  /**
   * REMOVED: No longer using JSON fallback - MongoDB only!
   * Fallback: Load products from JSON file (deprecated - should not be called)
   */
  private loadProductsFromJSON(): void {
    // This method is kept for reference but should not be called
    // All data should come from MongoDB only
    console.warn('⚠️ loadProductsFromJSON() is deprecated. Use MongoDB only.');
    return; // Early return to prevent execution

    this.isLoading = true;
    this.loadError = '';

    // Path to products.json in the data folder (relative path) (deprecated)
    const dataPath = 'data/products.json';

    this.http.get<ProductJSON[]>(dataPath).subscribe({
      next: (data) => {
        console.log(`✅ Loaded ${data.length} products from JSON`);

        // Use ALL products instead of selecting only 100
        console.log(`📊 Displaying all ${data.length} products`);

        // Map JSON data to Product interface
        this.allProducts = data.map((item, index) => mapProductFromJSON(item, index));

        // Extract unique categories for filter
        this.extractCategories();

        // Apply default sort (by updated date, descending)
        this.updateProductsList();

        this.isLoading = false;
        console.log('Products loaded successfully:', this.products.length);

        // Extract group names
        this.extractAllGroupNames();

        // Log category distribution
        const categoryCount = new Map<string, number>();
        this.products.forEach((p) => {
          const key = `${p.category} > ${p.subcategory}`;
          categoryCount.set(key, (categoryCount.get(key) || 0) + 1);
        });
        console.log('Category distribution:', Array.from(categoryCount.entries()));
        console.log('Available categories:', this.availableCategories);
      },
      error: (error) => {
        console.error('❌ Error loading products:', error);
        console.error('   Check if data/products.json exists in the unified data folder');
        this.loadError = 'Không thể tải dữ liệu sản phẩm. Vui lòng thử lại.';
        this.isLoading = false;

        // Fallback to sample data
        this.loadSampleData();
      },
    });
  }

  /**
   * Load sample data as fallback
   */
  private loadSampleData(): void {
    console.log('Loading sample data as fallback');
    this.allProducts = [
      {
        id: 1,
        name: 'Tên sản phẩm',
        code: 'Mã sản phẩm',
        unit: 'ABC',
        stock: 5,
        category: 'ABC',
        price: 100000,
        rating: 3,
        updated: '10-08-2025',
        selected: false,
      },
      {
        id: 2,
        name: 'Tên sản phẩm',
        code: 'Mã sản phẩm',
        unit: 'ABC',
        stock: 100,
        category: 'ABC',
        price: 150000,
        rating: 4,
        updated: '09-12-2025',
        selected: false,
      },
      {
        id: 3,
        name: 'Tên sản phẩm',
        code: 'Mã sản phẩm',
        unit: 'ABC',
        stock: 0,
        category: 'ABC',
        price: 200000,
        rating: 5,
        updated: 'xx-xx-xxxx',
        selected: false,
      },
      {
        id: 4,
        name: 'Tên sản phẩm',
        code: 'Mã sản phẩm',
        unit: 'ABC',
        stock: 0,
        category: 'ABC',
        price: 80000,
        rating: 5,
        updated: 'xx-xx-xxxx',
        selected: false,
      },
    ];
    // Apply default sort
    this.updateProductsList();
  }

  /**
   * Toggle select all products
   */
  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    this.products.forEach((product) => (product.selected = this.selectAll));
    this.updateSelectedCount();
  }

  /**
   * Toggle individual product selection
   */
  toggleProduct(product: Product): void {
    product.selected = !product.selected;
    this.updateSelectedCount();
    this.selectAll = this.products.every((p) => p.selected);
  }

  /**
   * Update selected count
   */
  updateSelectedCount(): void {
    this.selectedCount = countSelectedProducts(this.products);
  }

  /**
   * Add new product
   */
  addProduct(): void {
    this.editingProduct = false;
    this.currentProduct = createEmptyProduct();
    this.originalProduct = null; // Không có dữ liệu ban đầu khi thêm mới
    this.showProductForm = true;
    // Extract categories and colors when opening form
    this.extractCategories();
    this.extractColors();
    // Reset form subcategories
    this.formSubcategories = [];
  }

  /**
   * Close product form
   */
  closeProductForm(): void {
    // Revert về trạng thái ban đầu nếu có
    if (this.originalProduct) {
      this.currentProduct = JSON.parse(JSON.stringify(this.originalProduct)); // Deep copy
      this.originalProduct = null;
    }
    this.showProductForm = false;
    this.editingProduct = false;
  }

  /**
   * Save product
   */
  saveProduct(): void {
    const validation = validateProduct(this.currentProduct);

    if (!validation.isValid) {
      this.notificationService.showError('Lỗi: ' + validation.errors.join(', '));
      return;
    }

    // Map Product interface to backend format
    const productData: any = {
      _id: this.currentProduct.code || this.currentProduct.id?.toString(),
      product_name: this.currentProduct.name,
      sku: this.currentProduct.sku || this.currentProduct.code,
      category: this.currentProduct.category,
      subcategory: this.currentProduct.subcategory || '',
      brand: this.currentProduct.brand || '',
      unit: this.currentProduct.unit,
      price: this.currentProduct.price,
      base_price: this.currentProduct.originalPrice || this.currentProduct.price,
      stock: this.currentProduct.stock || 0, // Thêm trường stock
      image:
        this.currentProduct.images ||
        (this.currentProduct.image ? [this.currentProduct.image] : []),
      origin: this.currentProduct.origin || '',
      weight: this.currentProduct.weight || '',
      ingredients: this.currentProduct.ingredients || '',
      usage: this.currentProduct.usage || '',
      storage: this.currentProduct.storage || '',
      manufacture_date: this.currentProduct.manufactureDate || '',
      expiry_date: this.currentProduct.expiryDate || '',
      producer: this.currentProduct.producer || '',
      safety_warning: this.currentProduct.safetyWarning || '',
      responsible_org: this.currentProduct.responsibleOrg || '',
      color: this.currentProduct.color || '',
      status: 'Active',
      // Thêm các trường bổ sung nếu có
      // Rating không được set khi tạo mới, sẽ được tính từ reviews
      // Nếu đang edit và có rating từ reviews, giữ nguyên
      rating:
        this.currentProduct.rating !== undefined && this.currentProduct.rating !== null
          ? this.currentProduct.rating
          : undefined,
      purchase_count: 0,
      liked: 0,
      groups: this.currentProduct.groups || [],
    };

    // Gọi API để lưu sản phẩm
    // Khi chỉnh sửa, luôn dùng _id gốc từ originalProduct để đảm bảo tìm đúng sản phẩm
    // (vì user có thể đã thay đổi code trong form)
    let productId = '';
    if (this.editingProduct && this.originalProduct) {
      // Ưu tiên dùng code từ originalProduct (là _id gốc)
      productId = this.originalProduct.code || this.originalProduct.id?.toString() || '';
    } else {
      // Khi tạo mới hoặc không có originalProduct, dùng code hiện tại
      productId = this.currentProduct.code || this.currentProduct.id?.toString() || '';
    }

    console.log('💾 Saving product:', {
      editing: this.editingProduct,
      productId: productId,
      currentCode: this.currentProduct.code,
      originalCode: this.originalProduct?.code,
      name: this.currentProduct.name,
    });

    if (this.editingProduct && productId) {
      // Cập nhật sản phẩm hiện có
      console.log(`📤 Calling API: PUT /api/products/${productId}`);
      this.apiService.updateProduct(productId, productData).subscribe({
        next: (response) => {
          console.log('✅ Product updated successfully:', response);
          this.notificationService.showSuccess('Đã cập nhật sản phẩm thành công!');

          // Đóng form trước
          this.showProductForm = false;
          this.editingProduct = false;

          // Xóa bản sao ban đầu vì đã lưu thành công
          this.originalProduct = null;
          this.currentProduct = createEmptyProduct();

          // Reload products để lấy ngày cập nhật mới nhất và hiển thị trong danh sách
          this.loadProducts();

          // Force change detection để đảm bảo UI được cập nhật
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ Error updating product:', error);
          console.error('❌ Error details:', {
            status: error.status,
            message: error.message,
            error: error.error,
          });
          this.notificationService.showError(
            'Lỗi khi cập nhật sản phẩm: ' + (error.error?.message || error.message)
          );
        },
      });
    } else {
      // Tạo sản phẩm mới
      console.log(`📤 Calling API: POST /api/products`);
      console.log('📦 Product data to create:', productData);

      this.apiService.createProduct(productData).subscribe({
        next: (response) => {
          console.log('✅ Product created successfully:', response);
          this.notificationService.showSuccess('Đã tạo sản phẩm mới thành công!');

          // Đóng form trước
          this.showProductForm = false;
          this.editingProduct = false;

          // Reset current product
          this.currentProduct = createEmptyProduct();
          this.originalProduct = null;

          // Reload products để lấy sản phẩm mới với ngày cập nhật và hiển thị trong danh sách
          this.loadProducts();

          // Force change detection để đảm bảo UI được cập nhật
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('❌ Error creating product:', error);
          console.error('❌ Error details:', {
            status: error.status,
            message: error.message,
            error: error.error,
          });
          this.notificationService.showError(
            'Lỗi khi tạo sản phẩm: ' + (error.error?.message || error.message)
          );
        },
      });
    }
  }

  /**
   * Handle image selection
   */
  onImageSelect(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.notificationService.showError('Vui lòng chọn file ảnh hợp lệ');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.notificationService.showError('Kích thước ảnh không được vượt quá 5MB');
        return;
      }

      // Create FileReader to convert image to base64 or use object URL
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const imageUrl = e.target.result; // Base64 data URL

        // Initialize images array if not exists
        if (!this.currentProduct.images) {
          this.currentProduct.images = [];
        }

        // If replacing existing image at this index
        if (index < this.currentProduct.images.length) {
          // Replace image at this index
          this.currentProduct.images[index] = imageUrl;
        } else {
          // Add new image
          // Find first empty slot or add to end
          const emptyIndex = this.currentProduct.images.findIndex((img) => !img || img === '');
          if (emptyIndex >= 0) {
            this.currentProduct.images[emptyIndex] = imageUrl;
          } else {
            // Add to end if no empty slot
            this.currentProduct.images.push(imageUrl);
          }
        }

        // Update main image (first image or only image)
        if (this.currentProduct.images.length > 0) {
          // Get first non-empty image
          const firstImage =
            this.currentProduct.images.find((img) => img && img !== '') ||
            this.currentProduct.images[0];
          this.currentProduct.image = firstImage;
        }

        // Trigger change detection to update UI
        this.cdr.detectChanges();

        console.log('✅ Image uploaded successfully:', {
          index,
          fileName: file.name,
          fileSize: file.size,
          totalImages: this.currentProduct.images.length,
          mainImage: this.currentProduct.image,
        });
      };

      reader.onerror = (error) => {
        console.error('❌ Error reading image file:', error);
        this.notificationService.showError('Lỗi khi đọc file ảnh');
      };

      // Read file as data URL (base64)
      reader.readAsDataURL(file);

      // Reset input to allow selecting same file again
      input.value = '';
    }
  }

  /**
   * Get product images array (up to 4 images)
   */
  getProductImages(): (string | null)[] {
    if (!this.currentProduct) {
      return [null, null, null, null];
    }

    // Initialize images array if not exists
    if (!this.currentProduct.images) {
      this.currentProduct.images = [];
    }

    // Filter out empty strings and get first 4 images
    const validImages = this.currentProduct.images.filter((img) => img && img !== '').slice(0, 4);
    const result: (string | null)[] = [...validImages];

    // Fill remaining slots with null to always have 4 slots
    while (result.length < 4) {
      result.push(null);
    }

    return result;
  }

  /**
   * Handle image loading error
   */
  handleImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/asset/icons/shop.png'; // Fallback image
  }

  /**
   * Remove image at index
   */
  removeImage(index: number): void {
    if (!this.currentProduct) {
      return;
    }

    // Initialize images array if not exists
    if (!this.currentProduct.images) {
      this.currentProduct.images = [];
      return;
    }

    // Get valid images (non-empty)
    const validImages = this.currentProduct.images.filter((img) => img && img !== '');

    if (index < validImages.length) {
      // Remove image at index from valid images
      validImages.splice(index, 1);

      // Update images array
      this.currentProduct.images = validImages;

      // Update main image (first image or empty)
      if (this.currentProduct.images.length > 0) {
        this.currentProduct.image = this.currentProduct.images[0];
      } else {
        this.currentProduct.image = '';
        this.currentProduct.images = [];
      }

      // Trigger change detection to update UI
      this.cdr.detectChanges();

      console.log('✅ Image removed. Remaining images:', this.currentProduct.images.length);
    }
  }

  /**
   * Handle field change - DISABLED AUTO-SAVE
   * Changes are only saved when user clicks "LƯU" button
   */
  onFieldChange(fieldName: string, value: any): void {
    // AUTO-SAVE DISABLED: Changes are only saved when user clicks "LƯU" button
    // No automatic saving - all changes are stored in currentProduct and saved via saveProduct()
    return;

    // COMMENTED OUT: Auto-save functionality
    // // Chỉ tự động cập nhật khi đang chỉnh sửa sản phẩm đã tồn tại
    // if (!this.editingProduct || !this.originalProduct) {
    //   return;
    // }

    // // Clear existing timer
    // if (this.autoSaveTimer) {
    //   clearTimeout(this.autoSaveTimer);
    // }

    // // Set new timer
    // this.autoSaveTimer = setTimeout(() => {
    //   this.autoUpdateField(fieldName, value);
    // }, this.AUTO_SAVE_DELAY);
  }

  /**
   * Auto-update a specific field in MongoDB and sync with JSON
   */
  private autoUpdateField(fieldName: string, value: any): void {
    if (!this.editingProduct || !this.originalProduct) {
      return;
    }

    // Get product ID
    const productId = this.originalProduct.code || this.originalProduct.id?.toString() || '';
    if (!productId) {
      console.warn('⚠️ Cannot auto-update: Product ID not found');
      return;
    }

    // Map frontend field name to backend field name
    const backendFieldName = this.fieldMapping[fieldName] || fieldName;

    // Special handling for certain fields
    let backendValue = value;
    if (fieldName === 'code') {
      // Don't update _id via PATCH, it's handled differently
      return;
    }
    if (fieldName === 'originalPrice') {
      backendValue = value || this.currentProduct.price;
    }

    console.log(`🔄 Auto-updating field "${fieldName}" (${backendFieldName}) = ${backendValue}`);

    // Call PATCH API to update the field
    this.apiService.updateProductField(productId, backendFieldName, backendValue).subscribe({
      next: (response) => {
        console.log(`✅ Field "${fieldName}" auto-updated successfully`);
        // Optionally show a subtle notification
        // this.notificationService.showInfo(`Đã cập nhật ${fieldName}`);
      },
      error: (error) => {
        console.error(`❌ Error auto-updating field "${fieldName}":`, error);
        // Don't show error notification for auto-updates to avoid spam
      },
    });
  }

  /**
   * Edit selected products
   */
  editProducts(): void {
    const selected = getSelectedProducts(this.products);
    if (selected.length === 1) {
      // Lưu bản sao ban đầu trước khi chỉnh sửa
      this.originalProduct = JSON.parse(JSON.stringify(selected[0])); // Deep copy
      this.currentProduct = JSON.parse(JSON.stringify(selected[0])); // Deep copy để chỉnh sửa
      this.editingProduct = true;
      this.showProductForm = true;
      // Extract categories and colors when opening form
      this.extractCategories();
      this.extractColors();
      // Load subcategories for current category
      if (this.currentProduct.category) {
        this.onCategoryChange(this.currentProduct.category);
      } else {
        this.formSubcategories = [];
      }
    } else if (selected.length > 1) {
      this.notificationService.showWarning('Vui lòng chọn chỉ 1 sản phẩm để chỉnh sửa');
    } else {
      this.notificationService.showWarning('Vui lòng chọn sản phẩm để chỉnh sửa');
    }
  }

  /**
   * View product detail (click on row)
   */
  viewProductDetail(product: Product): void {
    // Lưu bản sao ban đầu trước khi chỉnh sửa
    this.originalProduct = JSON.parse(JSON.stringify(product)); // Deep copy
    this.currentProduct = JSON.parse(JSON.stringify(product)); // Deep copy để chỉnh sửa
    this.editingProduct = true;
    this.showProductForm = true;
  }

  /**
   * Delete selected products
   */
  deleteProducts(): void {
    // Check if any products are selected
    const selected = this.products.filter((p) => p.selected);

    if (selected.length === 0) {
      this.displayPopup('Vui lòng chọn sản phẩm cần xóa', 'error');
      return;
    }

    // Show confirmation dialog
    this.showConfirmation(`Bạn có chắc chắn muốn xóa ${selected.length} sản phẩm?`, () => {
      // Delete products via API - check for pending orders first
      this.processDeleteProducts(selected);
    });
  }

  /**
   * Process delete products - check for pending orders first
   */
  processDeleteProducts(selected: Product[]): void {
    // Collect all products that need to be deleted
    const productsToDelete: { productId: string; productName: string }[] = [];
    const allAffectedOrders: any[] = [];
    const allOrderIds = new Set<string>();

    // First, check each product for pending orders
    const checkPromises = selected.map((product) => {
      let productId = product._id || product.code || product.sku || product.name;
      if (productId) {
        productId = String(productId);
      }

      if (!productId || productId === 'undefined' || productId === 'null') {
        return Promise.resolve({
          product,
          productId: '',
          response: { success: true, requiresConfirmation: false },
        });
      }

      return this.apiService
        .deleteProduct(productId)
        .toPromise()
        .then((response) => {
          // Check if response requires confirmation
          if (response && response.requiresConfirmation) {
            return { product, productId, response };
          }
          // Product can be deleted without confirmation
          return { product, productId, response: { success: true, requiresConfirmation: false } };
        })
        .catch((error) => {
          // If error response contains requiresConfirmation, handle it
          if (error.error && error.error.requiresConfirmation) {
            return { product, productId, response: error.error };
          }
          throw error;
        });
    });

    Promise.all(checkPromises)
      .then((results) => {
        // Separate products that require confirmation from those that don't
        const productsRequiringConfirmation: {
          product: Product;
          productId: string;
          response: any;
        }[] = [];
        const productsReadyToDelete: { product: Product; productId: string }[] = [];

        results.forEach((result) => {
          // Type guard: check if result has response and productId
          if (
            'response' in result &&
            'productId' in result &&
            result.response &&
            result.response.requiresConfirmation
          ) {
            productsRequiringConfirmation.push({
              product: result.product,
              productId: result.productId,
              response: result.response,
            });
            // Collect affected orders
            if (result.response.affectedOrders) {
              result.response.affectedOrders.forEach((order: any) => {
                if (!allOrderIds.has(order.OrderID)) {
                  allOrderIds.add(order.OrderID);
                  allAffectedOrders.push(order);
                }
              });
            }
          } else if ('productId' in result && result.productId) {
            productsReadyToDelete.push({ product: result.product, productId: result.productId });
          }
        });

        // If any products require confirmation, show warning dialog
        if (productsRequiringConfirmation.length > 0) {
          this.pendingDeleteProducts = productsRequiringConfirmation.map((r) => ({
            productId: r.productId,
            productName: r.product.name,
          }));
          this.affectedOrders = allAffectedOrders;
          this.orderWarningMessage = `Sản phẩm này đang có trong ${allAffectedOrders.length} đơn hàng đang xử lý. Xóa sản phẩm sẽ xóa sản phẩm khỏi các đơn hàng này và giảm tổng tiền tương ứng.`;
          this.orderWarningCallback = () => {
            // Delete all products (both requiring confirmation and ready to delete)
            this.executeDeleteProducts(
              [
                ...productsRequiringConfirmation.map((r) => ({
                  product: r.product,
                  productId: r.productId,
                })),
                ...productsReadyToDelete,
              ],
              true
            );
          };
          this.showOrderWarningDialog = true;
          if (this.cdr) {
            this.cdr.detectChanges();
          }
        } else {
          // No products require confirmation, proceed with deletion
          this.executeDeleteProducts(productsReadyToDelete, false);
        }
      })
      .catch((error) => {
        console.error('❌ Error checking products for deletion:', error);
        this.displayPopup(
          'Lỗi khi kiểm tra sản phẩm: ' + (error.error?.message || error.message),
          'error'
        );
      });
  }

  /**
   * Execute delete products (with or without confirmation)
   */
  executeDeleteProducts(
    productsToDelete: { product: Product; productId: string }[],
    confirm: boolean
  ): void {
    const deletePromises = productsToDelete.map(({ product, productId }) => {
      return this.apiService
        .deleteProduct(productId, confirm)
        .toPromise()
        .then((response) => {
          console.log(`✅ Delete API response for ${productId}:`, response);
          return response;
        })
        .catch((error) => {
          console.error(`❌ Delete API error for ${productId}:`, error);
          throw error;
        });
    });

    Promise.all(deletePromises)
      .then((results) => {
        console.log('📊 Delete results:', results);

        const validResults = results.filter((r) => r !== null && r !== undefined);
        const successResults = validResults.filter((r) => {
          if (r && typeof r === 'object') {
            return r.success !== false;
          }
          return true;
        });

        const successCount = successResults.length;
        const failedCount = validResults.length - successCount;

        // Check for affected orders (orders with products removed)
        const affectedOrders: string[] = [];
        results.forEach((r) => {
          if (r && r.affectedOrders && Array.isArray(r.affectedOrders)) {
            r.affectedOrders.forEach((order: any) => {
              if (order.OrderID && !affectedOrders.includes(order.OrderID)) {
                affectedOrders.push(order.OrderID);
              }
            });
          }
        });

        console.log(`✅ Deleted ${successCount} products successfully`);
        if (failedCount > 0) {
          console.warn(`⚠️ Failed to delete ${failedCount} products`);
        }

        // Reload products from MongoDB
        this.loadProducts();

        this.selectedCount = 0;
        this.selectAll = false;

        // Show success message with affected orders info if any
        if (affectedOrders.length > 0) {
          this.displayPopup(
            `Đã xóa ${successCount} sản phẩm thành công. Đã xóa sản phẩm khỏi ${affectedOrders.length} đơn hàng đang xử lý và cập nhật tổng tiền tương ứng.`,
            'success'
          );
        } else if (failedCount > 0) {
          this.displayPopup(
            `Đã xóa ${successCount} sản phẩm, ${failedCount} sản phẩm lỗi`,
            'error'
          );
        } else {
          this.displayPopup(`Đã xóa ${successCount} sản phẩm thành công`, 'success');
        }
      })
      .catch((error) => {
        console.error('❌ Error deleting products:', error);
        const errorMessage =
          error.error?.message || error.error?.error || error.message || 'Lỗi không xác định';
        this.displayPopup('Lỗi khi xóa sản phẩm: ' + errorMessage, 'error');
        this.loadProducts();
      });
  }

  /**
   * Confirm order warning and proceed with deletion
   */
  confirmOrderWarning(): void {
    if (this.orderWarningCallback) {
      this.orderWarningCallback();
      this.orderWarningCallback = null;
    }
    this.showOrderWarningDialog = false;
    this.affectedOrders = [];
    this.pendingDeleteProducts = [];
    this.orderWarningMessage = '';
  }

  /**
   * Cancel order warning
   */
  cancelOrderWarning(): void {
    this.showOrderWarningDialog = false;
    this.orderWarningCallback = null;
    this.affectedOrders = [];
    this.pendingDeleteProducts = [];
    this.orderWarningMessage = '';
  }

  /**
   * Display popup notification
   */
  displayPopup(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.popupMessage = message;
    this.popupType = type;
    this.showPopup = true;
  }

  /**
   * Close popup
   */
  closePopup(): void {
    this.showPopup = false;
    this.popupMessage = '';
  }

  /**
   * Show confirmation dialog
   */
  showConfirmation(message: string, callback: () => void): void {
    this.confirmMessage = message;
    this.confirmCallback = callback;
    this.showConfirmDialog = true;

    // Force change detection to ensure popup shows
    if (this.cdr) {
      this.cdr.detectChanges();
    }
  }

  /**
   * Confirm action
   */
  confirmDelete(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.showConfirmDialog = false;
  }

  /**
   * Cancel action
   */
  cancelDelete(): void {
    this.showConfirmDialog = false;
    this.confirmCallback = null;
    this.confirmMessage = '';
  }

  /**
   * Open filter modal
   */
  openFilter(): void {
    this.showFilterModal = true;
  }

  /**
   * Close filter modal
   */
  closeFilter(): void {
    this.showFilterModal = false;
  }

  /**
   * Apply filters
   */
  applyFilters(filters: FilterCriteria): void {
    this.currentFilters = filters;
    this.updateProductsList();
    this.closeFilter();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.currentFilters = {};
    this.availableSubcategories = []; // Clear subcategories when clearing all filters
    this.updateProductsList();
  }

  /**
   * Get count of active filters
   */
  getActiveFiltersCount(): number {
    let count = 0;
    if (this.currentFilters.stockStatus) count++;
    if (this.currentFilters.rating !== undefined && this.currentFilters.rating !== null) count++;
    if (this.currentFilters.category) count++;
    if (this.currentFilters.subcategory) count++;
    if (this.currentFilters.group) count++;
    return count;
  }

  /**
   * Toggle filter dropdown
   */
  toggleFilterDropdown(event?: Event): void {
    console.log('🔍 ========== TOGGLE FILTER DROPDOWN ==========');
    console.log('🔍 Before:', this.showFilterDropdown);
    console.log('🔍 Available Categories:', this.availableCategories);
    console.log('🔍 Current Filters:', this.currentFilters);

    if (event) {
      event.stopPropagation();
    }
    this.showFilterDropdown = !this.showFilterDropdown;

    console.log('🔍 After:', this.showFilterDropdown);
    console.log('🔍 ==========================================');

    if (this.showFilterDropdown) {
      this.showSortDropdown = false; // Close sort dropdown if open
    }
  }

  /**
   * Toggle sort dropdown
   */
  toggleSortDropdown(event?: Event): void {
    console.log('📊 Toggle Sort - Before:', this.showSortDropdown);
    if (event) {
      event.stopPropagation();
    }
    this.showSortDropdown = !this.showSortDropdown;
    console.log('📊 Toggle Sort - After:', this.showSortDropdown);
    if (this.showSortDropdown) {
      this.showFilterDropdown = false; // Close filter dropdown if open
    }
  }

  /**
   * Close all dropdowns when clicking outside
   */
  closeDropdowns(event: Event): void {
    const target = event.target as HTMLElement;

    // Don't close if clicking on dropdown button or inside dropdown
    if (!target.closest('.dropdown-container')) {
      if (this.showFilterDropdown || this.showSortDropdown) {
        console.log('❌ Closing dropdowns from outside click');
        this.showFilterDropdown = false;
        this.showSortDropdown = false;
      }
    }
  }

  /**
   * Toggle stock filter
   */
  toggleStockFilter(status: 'in-stock' | 'out-of-stock' | 'low-stock'): void {
    if (this.currentFilters.stockStatus === status) {
      this.currentFilters.stockStatus = undefined;
    } else {
      this.currentFilters.stockStatus = status;
    }
    this.updateProductsList();
  }

  /**
   * Toggle rating filter
   */
  toggleRatingFilter(rating: number): void {
    if (this.currentFilters.rating === rating) {
      this.currentFilters.rating = undefined;
    } else {
      this.currentFilters.rating = rating;
    }
    this.updateProductsList();
  }

  /**
   * Toggle category filter
   */
  toggleCategoryFilter(category: string): void {
    if (this.currentFilters.category === category) {
      this.currentFilters.category = undefined;
      this.currentFilters.subcategory = undefined;
      this.availableSubcategories = [];
    } else {
      this.currentFilters.category = category;
      this.currentFilters.subcategory = undefined;
      this.extractSubcategories(category);
    }
    this.updateProductsList();
  }

  /**
   * Toggle subcategory filter
   */
  toggleSubcategoryFilter(subcategory: string): void {
    if (this.currentFilters.subcategory === subcategory) {
      this.currentFilters.subcategory = undefined;
    } else {
      this.currentFilters.subcategory = subcategory;
    }
    this.updateProductsList();
  }

  /**
   * Toggle group filter
   */
  toggleGroupFilter(group: string): void {
    if (this.currentFilters.group === group) {
      this.currentFilters.group = undefined;
    } else {
      this.currentFilters.group = group;
    }
    this.updateProductsList();
  }

  /**
   * Sort products by field
   */
  sortBy(field: keyof Product): void {
    // Toggle order if same field, otherwise default to desc
    if (this.currentSortField === field) {
      this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortField = field;
      this.currentSortOrder = 'desc';
    }
    this.updateProductsList();

    // Close sort dropdown after selection
    setTimeout(() => {
      this.showSortDropdown = false;
    }, 150);
  }

  /**
   * Quick sort by stock status
   */
  sortByStock(status: 'in-stock' | 'out-of-stock' | 'low-stock' | 'all'): void {
    if (status === 'all') {
      this.currentFilters = { ...this.currentFilters, stockStatus: undefined };
    } else {
      this.currentFilters = { ...this.currentFilters, stockStatus: status };
    }
    this.updateProductsList();
  }

  /**
   * Extract unique categories from products
   */
  extractCategories(): void {
    const categories = new Set<string>();
    this.allProducts.forEach((product) => {
      if (product.category) {
        categories.add(product.category);
      }
    });
    this.availableCategories = Array.from(categories).sort();
  }

  /**
   * Extract subcategories for selected category
   */
  extractSubcategories(category: string): void {
    const subcategories = new Set<string>();
    this.allProducts
      .filter((product) => product.category === category)
      .forEach((product) => {
        if (product.subcategory) {
          subcategories.add(product.subcategory);
        }
      });
    this.availableSubcategories = Array.from(subcategories).sort();
  }

  /**
   * Extract subcategories for form dropdown (when category changes in form)
   */
  onCategoryChange(category: string): void {
    if (!category) {
      this.formSubcategories = [];
      return;
    }
    const subcategories = new Set<string>();
    this.allProducts
      .filter((product) => product.category === category)
      .forEach((product) => {
        if (product.subcategory) {
          subcategories.add(product.subcategory);
        }
      });
    this.formSubcategories = Array.from(subcategories).sort();
    // Reset subcategory if current one is not in the new list
    if (
      this.currentProduct.subcategory &&
      !this.formSubcategories.includes(this.currentProduct.subcategory)
    ) {
      this.currentProduct.subcategory = '';
    }
  }

  /**
   * Extract available colors from all products
   */
  extractColors(): void {
    const colors = new Set<string>();
    this.allProducts.forEach((product) => {
      if (product.color && typeof product.color === 'string' && product.color.trim()) {
        // Handle multiple colors separated by comma or semicolon
        const colorParts = product.color
          .split(/[,;]/)
          .map((c) => c.trim())
          .filter((c) => c);
        colorParts.forEach((color) => {
          if (color) {
            colors.add(color);
          }
        });
      }
    });
    // Add common colors if not found in products
    const commonColors = [
      'Đỏ',
      'Xanh',
      'Vàng',
      'Xanh lá',
      'Tím',
      'Cam',
      'Hồng',
      'Đen',
      'Trắng',
      'Xám',
      'Nâu',
      'Be',
    ];
    commonColors.forEach((color) => {
      if (!colors.has(color)) {
        colors.add(color);
      }
    });
    this.availableColors = Array.from(colors).sort();
  }

  /**
   * Select category and update subcategories
   */
  selectCategory(category: string): void {
    this.currentFilters.category = category;
    this.currentFilters.subcategory = undefined; // Reset subcategory
    this.extractSubcategories(category);
    this.updateProductsList();
  }

  /**
   * Select subcategory
   */
  selectSubcategory(subcategory: string): void {
    this.currentFilters.subcategory = subcategory;
    this.updateProductsList();
  }

  /**
   * Update products list with current filters and sort
   */
  updateProductsList(): void {
    let result = [...this.allProducts];

    // Check if product SKU 3422157 exists in allProducts
    const targetProductInAll = this.allProducts.find((p) => p.sku === '3422157');
    if (targetProductInAll) {
      console.log('🔍 [Update List] Product SKU 3422157 in allProducts:', {
        sku: targetProductInAll.sku,
        name: targetProductInAll.name,
        status: (targetProductInAll as any).status,
        stock: targetProductInAll.stock,
      });
    } else {
      console.warn('⚠️ [Update List] Product SKU 3422157 NOT found in allProducts');
    }

    // Apply filters
    if (Object.keys(this.currentFilters).length > 0) {
      result = filterProductsByCriteria(result, this.currentFilters);

      // Check if product SKU 3422157 exists after filtering
      const targetProductAfterFilter = result.find((p) => p.sku === '3422157');
      if (targetProductAfterFilter) {
        console.log('✅ [Update List] Product SKU 3422157 PASSED filters:', {
          sku: targetProductAfterFilter.sku,
          name: targetProductAfterFilter.name,
          currentFilters: this.currentFilters,
        });
      } else if (targetProductInAll) {
        console.warn('❌ [Update List] Product SKU 3422157 FILTERED OUT by:', this.currentFilters);
      }
    } else {
      // No filters applied
      const targetProductInResult = result.find((p) => p.sku === '3422157');
      if (targetProductInResult) {
        console.log('✅ [Update List] Product SKU 3422157 in result (no filters):', {
          sku: targetProductInResult.sku,
          name: targetProductInResult.name,
        });
      }
    }

    // Apply sort
    if (this.currentSortField) {
      result = sortProductsByField(result, this.currentSortField, this.currentSortOrder);
    }

    this.products = result;

    // Final check: is product SKU 3422157 in final products array?
    const targetProductFinal = this.products.find((p) => p.sku === '3422157');
    if (targetProductFinal) {
      console.log('✅ [Update List] Product SKU 3422157 WILL BE DISPLAYED in table');
    } else {
      console.warn('❌ [Update List] Product SKU 3422157 WILL NOT BE DISPLAYED in table');
      console.log('📊 [Update List] Total products in table:', this.products.length);
    }

    // Reset selection
    this.selectedCount = 0;
    this.selectAll = false;

    console.log(`Filtered & sorted: ${result.length} products`);
  }

  /**
   * Search products
   */
  searchProducts(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    console.log('Search:', query);

    if (!query || query.trim() === '') {
      // Reset to all products if search is empty
      this.updateProductsList();
    } else {
      // Search products by query
      let results = searchProductsByQuery(this.allProducts, query);

      // Apply current filters
      if (Object.keys(this.currentFilters).length > 0) {
        results = filterProductsByCriteria(results, this.currentFilters);
      }

      // Apply current sort
      if (this.currentSortField) {
        results = sortProductsByField(results, this.currentSortField, this.currentSortOrder);
      }

      this.products = results;
      console.log(`Search results: ${results.length} products`);
    }

    // Reset selection
    this.selectedCount = 0;
    this.selectAll = false;
  }

  /**
   * Get stock class for styling
   */
  getStockClass(stock: number): string {
    return getStockClass(stock);
  }

  /**
   * Calculate ratings from reviews for products
   * This method fetches all reviews and calculates average rating for each product
   */
  calculateRatingsFromReviews(): void {
    console.log('🔄 Calculating ratings from reviews...');

    // Get all reviews from API
    this.apiService.getReviews().subscribe({
      next: (reviewsData: any[]) => {
        console.log(`✅ Loaded ${reviewsData.length} review documents`);

        // Create a map of SKU -> average rating
        const ratingMap: { [sku: string]: number } = {};

        reviewsData.forEach((reviewDoc: any) => {
          if (
            reviewDoc.sku &&
            reviewDoc.reviews &&
            Array.isArray(reviewDoc.reviews) &&
            reviewDoc.reviews.length > 0
          ) {
            // Calculate average rating for this product
            const totalRating = reviewDoc.reviews.reduce((sum: number, review: any) => {
              return sum + (review.rating || 0);
            }, 0);

            const averageRating = totalRating / reviewDoc.reviews.length;
            // Round to 1 decimal place
            const roundedRating = Math.round(averageRating * 10) / 10;

            ratingMap[reviewDoc.sku] = roundedRating;
          }
        });

        console.log(
          `📊 Calculated ratings for ${Object.keys(ratingMap).length} products from reviews`
        );

        // Update products with calculated ratings
        let updatedCount = 0;
        let zeroedCount = 0;
        this.allProducts.forEach((product) => {
          // Kiểm tra purchase_count: nếu = 0 thì rating = 0 (không có đánh giá)
          const purchaseCount = product.PurchaseCount || 0;
          if (purchaseCount === 0) {
            // Nếu purchase_count = 0, set rating = 0
            if (product.rating !== undefined && product.rating !== null && product.rating !== 0) {
              product.rating = 0;
              zeroedCount++;
            } else if (product.rating === undefined || product.rating === null) {
              product.rating = 0;
              zeroedCount++;
            }
          } else if (product.sku && ratingMap[product.sku] !== undefined) {
            // Chỉ update rating từ reviews nếu purchase_count > 0
            // Only update if product doesn't have rating or rating is 0
            if (product.rating === undefined || product.rating === null || product.rating === 0) {
              product.rating = ratingMap[product.sku];
              updatedCount++;
            }
          }
        });

        console.log(`✅ Updated ${updatedCount} products with ratings from reviews`);
        console.log(`🔄 Set rating = 0 for ${zeroedCount} products with PurchaseCount = 0`);

        // Update products list to reflect new ratings
        this.updateProductsList();
      },
      error: (error) => {
        console.error('❌ Error loading reviews to calculate ratings:', error);
        // Don't fail - products will just show undefined rating
      },
    });
  }

  /**
   * Get star rating array
   */
  getStarArray(rating: number | undefined): StarType[] {
    return getStarArray(rating);
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }

  /**
   * Get discount percentage
   */
  getDiscountPercentage(originalPrice: number, salePrice: number): number {
    return calculateDiscountPercentage(originalPrice, salePrice);
  }

  /**
   * Export products to CSV
   */
  exportToCSV(): void {
    const csvContent = exportProductsToCSV(this.products);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `products_${getCurrentDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * ============================================================================
   * GROUP MANAGEMENT METHODS
   * ============================================================================
   */

  /**
   * Open group modal to create new group for selected products
   */
  openGroupModal(): void {
    const selected = getSelectedProducts(this.products);
    if (selected.length < 2) {
      this.notificationService.showWarning('Vui lòng chọn ít nhất 2 sản phẩm để nhóm');
      return;
    }
    this.newGroupName = '';
    this.showGroupModal = true;
  }

  /**
   * Close group modal
   */
  closeGroupModal(): void {
    this.showGroupModal = false;
    this.newGroupName = '';
  }

  /**
   * Create group and assign to selected products
   */
  createGroup(): void {
    if (!this.newGroupName || this.newGroupName.trim() === '') {
      this.notificationService.showWarning('Vui lòng nhập tên nhóm');
      return;
    }

    const groupName = this.newGroupName.trim();
    const selected = getSelectedProducts(this.products);

    if (selected.length < 2) {
      this.notificationService.showWarning('Vui lòng chọn ít nhất 2 sản phẩm để nhóm');
      return;
    }

    // Get SKUs of selected products - filter out undefined and empty values
    const skus = selected
      .map((p) => p.sku)
      .filter((sku): sku is string => !!sku && typeof sku === 'string' && sku.trim() !== ''); // Type guard to ensure string[]

    if (skus.length === 0) {
      this.notificationService.showError('Không tìm thấy SKU của sản phẩm đã chọn');
      return;
    }

    console.log(`📦 Creating group "${groupName}" for ${skus.length} products`);

    // Call API to create group
    this.apiService.createProductGroup(groupName, skus).subscribe({
      next: (response) => {
        console.log('✅ Group created successfully:', response);

        // Reload products to get updated data from backend
        this.loadProducts();

        // Update group names list
        this.extractAllGroupNames();

        this.notificationService.showSuccess(
          response.message || `Đã tạo nhóm "${groupName}" và gán cho ${selected.length} sản phẩm`
        );
        this.closeGroupModal();
      },
      error: (error) => {
        console.error('❌ Error creating group:', error);
        this.notificationService.showError(
          error.error?.message || `Lỗi khi tạo nhóm: ${error.message}`
        );
      },
    });
  }

  /**
   * Extract all unique group names from products
   * Loads from API first, then falls back to local products
   */
  extractAllGroupNames(): void {
    // Load groups from API
    this.apiService.getProductGroups().subscribe({
      next: (groups) => {
        console.log('✅ Loaded product groups from API:', groups);
        this.allGroupNames = groups.sort();
      },
      error: (error) => {
        console.warn('⚠️ Error loading groups from API, using local data:', error);
        // Fallback to local extraction
        const groupsSet = new Set<string>();
        this.allProducts.forEach((product) => {
          if (product.groups && product.groups.length > 0) {
            product.groups.forEach((group) => groupsSet.add(group));
          }
        });
        this.allGroupNames = Array.from(groupsSet).sort();
      },
    });
  }

  /**
   * Add selected group from dropdown to current product
   */
  addSelectedGroup(): void {
    if (!this.selectedGroupToAdd || this.selectedGroupToAdd.trim() === '') {
      return;
    }

    const groupName = this.selectedGroupToAdd.trim();
    const sku = this.currentProduct.sku;

    if (!sku) {
      this.notificationService.showError('Sản phẩm không có SKU');
      return;
    }

    if (!this.currentProduct.groups) {
      this.currentProduct.groups = [];
    }

    if (this.currentProduct.groups.includes(groupName)) {
      this.notificationService.showWarning('Sản phẩm đã thuộc nhóm này');
      return;
    }

    // Call API to add group
    this.apiService.updateProductGroup(sku, 'add', groupName).subscribe({
      next: (response) => {
        console.log('✅ Group added successfully:', response);

        // Update local state
        if (!this.currentProduct.groups) {
          this.currentProduct.groups = [];
        }
        if (!this.currentProduct.groups.includes(groupName)) {
          this.currentProduct.groups.push(groupName);
        }

        // Also update in allProducts
        const productInAll = this.allProducts.find((p) => p.sku === sku);
        if (productInAll) {
          if (!productInAll.groups) {
            productInAll.groups = [];
          }
          if (!productInAll.groups.includes(groupName)) {
            productInAll.groups.push(groupName);
          }
        }

        // Reset dropdown to placeholder
        this.selectedGroupToAdd = '';

        this.notificationService.showSuccess(`Đã thêm sản phẩm vào nhóm "${groupName}"`);
      },
      error: (error) => {
        console.error('❌ Error adding group:', error);
        this.notificationService.showError(
          error.error?.message || `Lỗi khi thêm nhóm: ${error.message}`
        );
      },
    });
  }

  /**
   * Remove group from current product
   */
  removeGroupFromProduct(groupName: string): void {
    const sku = this.currentProduct.sku;

    if (!sku) {
      this.notificationService.showError('Sản phẩm không có SKU');
      return;
    }

    // Call API to remove group
    this.apiService.updateProductGroup(sku, 'remove', groupName).subscribe({
      next: (response) => {
        console.log('✅ Group removed successfully:', response);

        // Update local state
        if (this.currentProduct.groups) {
          this.currentProduct.groups = this.currentProduct.groups.filter((g) => g !== groupName);
        }

        // Also update in allProducts
        const productInAll = this.allProducts.find((p) => p.sku === sku);
        if (productInAll && productInAll.groups) {
          productInAll.groups = productInAll.groups.filter((g) => g !== groupName);
        }

        this.notificationService.showSuccess(`Đã xóa sản phẩm khỏi nhóm "${groupName}"`);
      },
      error: (error) => {
        console.error('❌ Error removing group:', error);
        this.notificationService.showError(
          error.error?.message || `Lỗi khi xóa nhóm: ${error.message}`
        );
      },
    });
  }
}
