import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-customerdetail',
  imports: [CommonModule, FormsModule],
  templateUrl: './customerdetail.html',
  styleUrl: './customerdetail.css',
  standalone: true
})
export class CustomerDetail implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);

  customerId: string = '';
  customer: any = null;
  orders: any[] = [];
  
  // Edit mode
  isEditMode = false;
  shouldEnterEditMode = false; // Flag to track if we should enter edit mode after data loads
  editableData: any = {};

  // Address data
  provinces: any[] = [];
  districts: any[] = [];
  wards: any[] = [];
  
  selectedProvince: string = '';
  selectedDistrict: string = '';
  selectedWard: string = '';
  streetAddress: string = '';

  // Multiple addresses
  addresses: any[] = [];
  isAddingNewAddress: boolean = false;
  editingAddressIndex: number = -1;

  // Customer data
  customerData = {
    id: '',
    name: '',
    gender: '',
    email: '',
    birthdate: '',
    phone: '',
    address: '',
    memberTier: '',
    customerType: '',
    joinDate: '',
    recentOrder: '---',
    totalSpent: '---',
    totalOrders: '---',
    hasAccount: false,
    emailConsent: false
  };

  ngOnInit(): void {
    // Check if we should enter edit mode from query params
    // Query params are more reliable than navigation state
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['edit'] === 'true') {
        console.log('✅ Edit mode requested from query params');
        this.shouldEnterEditMode = true;
      }
    });
    
    // Also check navigation state (for backward compatibility)
    const navigation = this.router.getCurrentNavigation();
    let state = navigation?.extras?.state;
    
    // Fallback to window.history.state if navigation state is not available
    if (!state) {
      state = window.history.state;
    }
    
    console.log('🔍 Navigation state:', state);
    
    // Set flag if editMode is requested from state (if not already set from query params)
    if (!this.shouldEnterEditMode && state?.['editMode'] === true) {
      console.log('✅ Edit mode requested from navigation state');
      this.shouldEnterEditMode = true;
    }
    
    // Check query params from snapshot (for immediate check)
    if (this.route.snapshot.queryParams['edit'] === 'true') {
      console.log('✅ Edit mode requested from query params (snapshot)');
      this.shouldEnterEditMode = true;
    }
    
    this.route.params.subscribe(params => {
      this.customerId = params['id'];
      this.loadCustomerDetail();
    });

    // Load address data
    this.loadAddressData();
  }

  /**
   * Load Vietnam address data
   */
  loadAddressData(): void {
    // Sample data for major cities and provinces in Vietnam
    this.provinces = [
      {
        code: 'HN',
        name: 'Hà Nội',
        districts: [
          {
            code: 'HN-BA',
            name: 'Ba Đình',
            wards: ['Phường Ngọc Hà', 'Phường Điện Biên', 'Phường Đội Cấn', 'Phường Nguyễn Trung Trực', 'Phường Quán Thánh']
          },
          {
            code: 'HN-HK',
            name: 'Hoàn Kiếm',
            wards: ['Phường Hàng Bạc', 'Phường Hàng Bồ', 'Phường Hàng Gai', 'Phường Lý Thái Tổ', 'Phường Tràng Tiền']
          },
          {
            code: 'HN-CG',
            name: 'Cầu Giấy',
            wards: ['Phường Dịch Vọng', 'Phường Nghĩa Đô', 'Phường Mai Dịch', 'Phường Yên Hòa', 'Phường Quan Hoa']
          },
          {
            code: 'HN-DD',
            name: 'Đống Đa',
            wards: ['Phường Văn Miếu', 'Phường Quốc Tử Giám', 'Phường Láng Thượng', 'Phường Ô Chợ Dừa', 'Phường Khâm Thiên']
          },
          {
            code: 'HN-HM',
            name: 'Hai Bà Trưng',
            wards: ['Phường Bạch Mai', 'Phường Thanh Nhàn', 'Phường Minh Khai', 'Phường Bạch Đằng', 'Phường Đồng Nhân']
          }
        ]
      },
      {
        code: 'HCM',
        name: 'Hồ Chí Minh',
        districts: [
          {
            code: 'HCM-Q1',
            name: 'Quận 1',
            wards: ['Phường Bến Nghé', 'Phường Bến Thành', 'Phường Nguyễn Thái Bình', 'Phường Phạm Ngũ Lão', 'Phường Tân Định']
          },
          {
            code: 'HCM-Q3',
            name: 'Quận 3',
            wards: ['Phường 01', 'Phường 02', 'Phường 03', 'Phường 04', 'Phường 05']
          },
          {
            code: 'HCM-PN',
            name: 'Phú Nhuận',
            wards: ['Phường 01', 'Phường 02', 'Phường 03', 'Phường 04', 'Phường 05']
          },
          {
            code: 'HCM-BT',
            name: 'Bình Thạnh',
            wards: ['Phường 01', 'Phường 02', 'Phường 03', 'Phường 05', 'Phường 06']
          },
          {
            code: 'HCM-TD',
            name: 'Thủ Đức',
            wards: ['Phường Linh Đông', 'Phường Linh Tây', 'Phường Linh Trung', 'Phường Tam Bình', 'Phường Tam Phú']
          }
        ]
      },
      {
        code: 'DN',
        name: 'Đà Nẵng',
        districts: [
          {
            code: 'DN-HC',
            name: 'Hải Châu',
            wards: ['Phường Thanh Bình', 'Phường Thạch Thang', 'Phường Hải Châu I', 'Phường Hải Châu II', 'Phường Phước Ninh']
          },
          {
            code: 'DN-SH',
            name: 'Sơn Trà',
            wards: ['Phường Thọ Quang', 'Phường Nại Hiên Đông', 'Phường Mân Thái', 'Phường An Hải Bắc', 'Phường Phước Mỹ']
          },
          {
            code: 'DN-CL',
            name: 'Cẩm Lệ',
            wards: ['Phường Hòa Phát', 'Phường Hòa An', 'Phường Hòa Thọ Tây', 'Phường Hòa Thọ Đông', 'Phường Khuê Trung']
          }
        ]
      },
      {
        code: 'HP',
        name: 'Hải Phòng',
        districts: [
          {
            code: 'HP-HK',
            name: 'Hồng Bàng',
            wards: ['Phường Quán Toan', 'Phường Hùng Vương', 'Phường Sở Dầu', 'Phường Thượng Lý', 'Phường Hạ Lý']
          },
          {
            code: 'HP-LC',
            name: 'Lê Chân',
            wards: ['Phường Cát Dài', 'Phường An Biên', 'Phường Lam Sơn', 'Phường An Dương', 'Phường Trần Nguyên Hãn']
          }
        ]
      },
      {
        code: 'CT',
        name: 'Cần Thơ',
        districts: [
          {
            code: 'CT-NK',
            name: 'Ninh Kiều',
            wards: ['Phường Cái Khế', 'Phường An Hòa', 'Phường Thới Bình', 'Phường An Nghiệp', 'Phường An Cư']
          },
          {
            code: 'CT-BT',
            name: 'Bình Thủy',
            wards: ['Phường Bình Thủy', 'Phường Trà An', 'Phường Trà Nóc', 'Phường Thới An Đông', 'Phường An Thới']
          }
        ]
      }
    ];
  }

  /**
   * Normalize customer ID to CUSxxxxxx format
   */
  private normalizeCustomerID(customerId: string): string {
    // If already in CUS format, return as is
    if (customerId.toUpperCase().startsWith('CUS')) {
      return customerId.toUpperCase();
    }
    
    // If in KH format, convert to CUS
    if (customerId.toUpperCase().startsWith('KH')) {
      const idNum = customerId.toUpperCase().replace('KH', '').replace(/^0+/, '') || '0';
      return `CUS${idNum.padStart(6, '0')}`;
    }
    
    // If just numbers, add CUS prefix
    const idNum = customerId.replace(/^0+/, '') || '0';
    return `CUS${idNum.padStart(6, '0')}`;
  }

  /**
   * Load customer detail from MongoDB
   */
  loadCustomerDetail(): void {
    // Normalize customer ID to CUSxxxxxx format
    const customerID = this.normalizeCustomerID(this.customerId);
    
    console.log(`📋 Loading customer detail for: ${customerID} (original: ${this.customerId})`);
    
    // Load from MongoDB API only
    this.http.get<any>(`http://localhost:3000/api/users/customer/${customerID}`).subscribe({
      next: (response) => {
        console.log('📋 API Response:', response);
        
        // Handle different response formats
        let customerData = null;
        if (response.success && response.customer) {
          customerData = response.customer;
        } else if (response.success && response.user) {
          customerData = response.user;
        } else if (response.CustomerID) {
          // Direct user object
          customerData = response;
        }
        
        if (customerData) {
          console.log('✅ Found customer in MongoDB:', customerData);
          this.customer = customerData;
          
          // Ensure CustomerID is set
          if (!this.customer.CustomerID && customerID) {
            this.customer.CustomerID = customerID;
          }
          
          // Load orders and addresses
          this.loadCustomerOrders();
          this.loadCustomerAddresses();
        } else {
          console.error('❌ Customer not found in MongoDB:', customerID);
          console.error('❌ Response:', response);
          alert(`Không tìm thấy khách hàng với ID: ${customerID}`);
        }
      },
      error: (error) => {
        console.error('❌ MongoDB API error:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        
        // Try to get more specific error message
        const errorMessage = error.error?.message || error.error?.error || error.message || 'Không tìm thấy khách hàng';
        alert(`Lỗi khi tải thông tin khách hàng: ${errorMessage}`);
      }
    });
  }

  /**
   * Load customer from JSON file (fallback)
   */
  loadCustomerFromJson(customerID: string): void {
    this.http.get<any[]>('data/temp/users.json').subscribe({
      next: (users) => {
        // Find customer by CustomerID
        this.customer = users.find((u: any) => u.CustomerID === customerID);
        
        if (this.customer) {
          console.log('✅ Found customer in JSON:', this.customer);
          this.loadCustomerOrders();
          this.loadCustomerAddresses();
        } else {
          console.error('❌ Customer not found in JSON:', customerID);
          // Show error message to user
          alert(`Không tìm thấy khách hàng với ID: ${customerID}`);
        }
      },
      error: (error) => {
        console.error('❌ Error loading customer from JSON:', error);
        alert('Lỗi khi tải thông tin khách hàng');
      }
    });
  }

  /**
   * Load customer orders from MongoDB
   */
  loadCustomerOrders(): void {
    if (!this.customer || !this.customer.CustomerID) {
      console.warn('⚠️ Cannot load orders: customer or CustomerID is missing');
      this.orders = [];
      this.transformCustomerData();
      return;
    }
    
    const customerID = this.customer.CustomerID;
    console.log(`📦 Loading orders for customer: ${customerID}`);
    
    // Load from MongoDB API only
    this.http.get<any>(`http://localhost:3000/api/orders/customer/${customerID}`).subscribe({
      next: (response) => {
        console.log('📦 Orders API Response:', response);
        
        // Handle different response formats
        let ordersData = [];
        if (response.success && response.orders) {
          ordersData = response.orders;
        } else if (response.success && response.data && Array.isArray(response.data)) {
          ordersData = response.data;
        } else if (Array.isArray(response)) {
          ordersData = response;
        }
        
        if (ordersData.length > 0) {
          console.log(`✅ Found ${ordersData.length} orders in MongoDB`);
          this.orders = ordersData;
        } else {
          console.log(`⚠️ No orders found in MongoDB for customer ${customerID}`);
          this.orders = [];
        }
        
        // Transform customer data after orders are loaded (or if no orders)
        this.transformCustomerData();
      },
      error: (error) => {
        console.error('❌ MongoDB API error for orders:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        this.orders = [];
        // Transform customer data even if orders fail
        this.transformCustomerData();
      }
    });
  }

  /**
   * Load orders from JSON file (fallback)
   */
  loadOrdersFromJson(customerID: string): void {
    this.http.get<any[]>('data/temp/orders.json').subscribe({
      next: (orders) => {
        // Filter orders by CustomerID
        this.orders = orders.filter((o: any) => o.CustomerID === customerID);
        console.log(`✅ Found ${this.orders.length} orders in JSON for customer ${customerID}`);
        // Transform customer data after orders are loaded
        this.transformCustomerData();
      },
      error: (error) => {
        console.error('❌ Error loading orders from JSON:', error);
        this.orders = [];
        this.transformCustomerData();
      }
    });
  }

  /**
   * Load customer addresses from MongoDB
   */
  loadCustomerAddresses(): void {
    if (!this.customer || !this.customer.CustomerID) {
      console.warn('⚠️ Cannot load addresses: customer or CustomerID is missing');
      this.addresses = [];
      return;
    }
    
        const customerID = this.customer.CustomerID;
    console.log(`📍 Loading addresses for customer: ${customerID}`);
    
    // Load from MongoDB API
    this.http.get<any>(`http://localhost:3000/api/address/${customerID}`).subscribe({
      next: (response) => {
        console.log('📍 Addresses API Response:', response);
        
        // Handle different response formats
        let addressesData = [];
        if (response.success && response.data && response.data.addresses && Array.isArray(response.data.addresses)) {
          addressesData = response.data.addresses;
        } else if (response.success && Array.isArray(response.addresses)) {
          addressesData = response.addresses;
        } else if (Array.isArray(response)) {
          addressesData = response;
        }
        
        if (addressesData.length > 0) {
          // Transform addresses to display format with Vietnamese formatting
          this.addresses = addressesData.map((addr: any) => {
            // Format address parts to Vietnamese
            const detail = addr.detail || '';
            const ward = this.formatAddressPart(addr.ward, 'ward', addr.city, addr.district);
            const district = this.formatAddressPart(addr.district, 'district', addr.city);
            const city = this.formatAddressPart(addr.city, 'city');
            
            // Build full address string
            const addressParts: string[] = [];
            if (detail) addressParts.push(detail);
            if (ward) addressParts.push(ward);
            if (district) addressParts.push(district);
            if (city) addressParts.push(city);
            
            return {
              id: addr._id?.toString() || Date.now().toString(),
              fullAddress: addressParts.join(', ') || 'Chưa có địa chỉ',
              isDefault: addr.isDefault || false,
              fullName: addr.fullName,
              phone: addr.phone,
              email: addr.email,
              city: addr.city,
              district: addr.district,
              ward: addr.ward,
              detail: addr.detail
            };
          });
          
          // Sort: default address first
          this.addresses.sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            return 0;
          });
          
          console.log(`✅ Loaded ${this.addresses.length} addresses for customer ${customerID}`);
        } else {
          console.log(`⚠️ No addresses found for customer ${customerID}`);
          this.addresses = [];
        }
      },
      error: (error) => {
        console.error('❌ Error loading addresses from MongoDB:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        this.addresses = [];
      }
    });
  }

  /**
   * Format address part to Vietnamese (ward, district, city)
   */
  private formatAddressPart(part: string, type: 'ward' | 'district' | 'city', provinceId?: string, districtId?: string): string {
    if (!part) return '';
    
    // Use AddressService-like logic to format Vietnamese names
    // For now, use simple formatting - can be enhanced later
    const formatted = this.formatVietnameseAddressName(part, type);
    return formatted;
  }

  /**
   * Format Vietnamese address name from slug/code
   */
  private formatVietnameseAddressName(slug: string, type: 'ward' | 'district' | 'city'): string {
    if (!slug) return '';
    
    // Common mappings
    const cityMap: { [key: string]: string } = {
      'hcm': 'Thành phố Hồ Chí Minh',
      'hn': 'Hà Nội',
      'ha-noi': 'Hà Nội',
      'dn': 'Đà Nẵng',
      'da-nang': 'Đà Nẵng',
      'soc-trang': 'Sóc Trăng',
      'can-tho': 'Cần Thơ',
      'quang-tri': 'Quảng Trị',
    };
    
    const districtMap: { [key: string]: string } = {
      'q1': 'Quận 1',
      'q2': 'Quận 2',
      'q3': 'Quận 3',
      'quan-1': 'Quận 1',
      'quan-2': 'Quận 2',
      'quan-3': 'Quận 3',
      'dong-mai': 'Đông Mai',
      'ha-dong': 'Hà Đông',
    };
    
    const wardMap: { [key: string]: string } = {
      'p1': 'Phường 1',
      'p2': 'Phường 2',
      'p3': 'Phường 3',
      'phuong-1': 'Phường 1',
      'phuong-2': 'Phường 2',
      'phuong-3': 'Phường 3',
    };
    
    if (type === 'city' && cityMap[slug.toLowerCase()]) {
      return cityMap[slug.toLowerCase()];
    }
    if (type === 'district' && districtMap[slug.toLowerCase()]) {
      return districtMap[slug.toLowerCase()];
    }
    if (type === 'ward' && wardMap[slug.toLowerCase()]) {
      return wardMap[slug.toLowerCase()];
    }
    
    // If it's just a number for ward, format as "Phường X"
    if (type === 'ward' && /^\d+$/.test(slug)) {
      return `Phường ${slug}`;
    }
    
    // Try to format from slug
    if (slug.includes('-')) {
      return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return slug;
  }

  /**
   * Transform customer data for display
   */
  transformCustomerData(): void {
    // Ensure customer data exists
    if (!this.customer) {
      console.warn('⚠️ Cannot transform customer data: customer is null');
      return;
    }
    
    console.log('🔄 Transforming customer data:', {
      CustomerID: this.customer.CustomerID,
      FullName: this.customer.FullName,
      ordersCount: this.orders.length
    });
    
    // Format RegisterDate from MongoDB date format (support both JSON and MongoDB format)
    // Output format: dd-mm-yyyy
    let formattedDate = '---';
    if (this.customer.RegisterDate || this.customer.register_date) {
      const registerDate = this.customer.RegisterDate || this.customer.register_date;
      let dateObj: Date | null = null;
      
      // Try to parse date from various formats
      if (typeof registerDate === 'string') {
        dateObj = new Date(registerDate);
      } else if (registerDate.$date) {
        // MongoDB format: { $date: "ISO string" }
        dateObj = new Date(registerDate.$date);
      } else if (registerDate instanceof Date) {
        // Already a Date object
        dateObj = registerDate;
      }
      
      // Format date as dd-mm-yyyy
      if (dateObj && !isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        formattedDate = `${day}-${month}-${year}`;
      }
    }

    // Get CustomerTiering from customer data (Đồng, Bạc, Vàng)
    const memberTier = this.customer.CustomerTiering || 'Đồng';
    
    // Map CustomerTiering to customerType
    let customerType = 'Regular';
    if (memberTier === 'Vàng') {
      customerType = 'VIP';
    } else if (memberTier === 'Bạc') {
      customerType = 'Premium';
    }

    // Calculate statistics from orders
    let recentOrder = '---';
    let totalSpent = '---';
    let totalOrders = '---';

    // Use TotalSpent from customer data if available and > 0 (from MongoDB), otherwise calculate from orders
    // Note: If TotalSpent is 0, it might be outdated, so we recalculate from orders
    if (this.customer.TotalSpent !== undefined && this.customer.TotalSpent !== null && this.customer.TotalSpent > 0) {
      totalSpent = this.formatCurrency(this.customer.TotalSpent);
    }

    // Calculate order statistics
    if (this.orders && this.orders.length > 0) {
      // Count all orders (for display)
      const allOrdersCount = this.orders.length;
      totalOrders = allOrdersCount.toString();
      
      // Calculate total spent - prioritize MongoDB TotalSpent, but also calculate from orders for verification
      if (this.customer.TotalSpent !== undefined && this.customer.TotalSpent !== null && this.customer.TotalSpent > 0) {
        // Use MongoDB TotalSpent if available
        totalSpent = this.formatCurrency(this.customer.TotalSpent);
        console.log(`💰 Using TotalSpent from MongoDB: ${this.customer.TotalSpent}`);
      } else {
        // Calculate from orders - include all non-cancelled/returned orders
        const calculatedTotal = this.orders.reduce((sum: number, order: any) => {
          const status = (order.status || '').toLowerCase();
          const paymentMethod = (order.paymentMethod || '').toLowerCase();
          const totalAmount = order.totalAmount || order.total || 0;
          
          // Skip cancelled/returned orders
          if (status === 'cancelled' || status === 'returned') {
            return sum;
          }
          
          // Count all other orders (assume they contribute to total spent)
          // This includes: pending, confirmed, processing, shipping, delivered, completed
            return sum + totalAmount;
        }, 0);
        
        totalSpent = calculatedTotal > 0 ? this.formatCurrency(calculatedTotal) : '---';
        
        // Log for debugging
        console.log(`💰 Calculated TotalSpent from orders: ${calculatedTotal.toLocaleString('vi-VN')}đ`);
        console.log(`   - Total orders: ${allOrdersCount}`);
      }
      
      // Find most recent order (any status)
      const sortedOrders = [...this.orders].sort((a: any, b: any) => {
        let dateA: Date, dateB: Date;
        
        // Handle date format from JSON or MongoDB
        if (a.createdAt?.$date) {
          dateA = new Date(a.createdAt.$date);
        } else if (a.createdAt instanceof Date) {
          dateA = a.createdAt;
        } else {
          dateA = new Date(a.createdAt || 0);
        }
        
        if (b.createdAt?.$date) {
          dateB = new Date(b.createdAt.$date);
        } else if (b.createdAt instanceof Date) {
          dateB = b.createdAt;
        } else {
          dateB = new Date(b.createdAt || 0);
        }
        
        return dateB.getTime() - dateA.getTime();
      });
      
      if (sortedOrders.length > 0) {
        let recentOrderDate: Date;
        const firstOrder = sortedOrders[0];
        
        // Handle date format from JSON or MongoDB
        if (firstOrder.createdAt?.$date) {
          recentOrderDate = new Date(firstOrder.createdAt.$date);
        } else if (firstOrder.createdAt instanceof Date) {
          recentOrderDate = firstOrder.createdAt;
        } else {
          recentOrderDate = new Date(firstOrder.createdAt || 0);
        }
        
        const day = String(recentOrderDate.getDate()).padStart(2, '0');
        const month = String(recentOrderDate.getMonth() + 1).padStart(2, '0');
        const year = recentOrderDate.getFullYear();
        recentOrder = `${day}-${month}-${year}`;
      }
    } else {
      // No orders - keep default values (---)
      console.log('⚠️ No orders found for customer, keeping default values');
    }

    // Format birthdate (support both JSON and MongoDB format)
    // Output format: dd-mm-yyyy
    let birthdate = '---';
    if (this.customer.BirthDay || this.customer.birthday) {
      const birthDayData = this.customer.BirthDay || this.customer.birthday;
      let birthDay: Date | null = null;
      
      if (typeof birthDayData === 'string') {
        birthDay = new Date(birthDayData);
      } else if (birthDayData.$date) {
        // MongoDB format: { $date: "ISO string" }
        birthDay = new Date(birthDayData.$date);
      } else if (birthDayData instanceof Date) {
        // MongoDB native Date object
        birthDay = birthDayData;
      }
      
      // Format date as dd-mm-yyyy
      if (birthDay && !isNaN(birthDay.getTime())) {
      const day = String(birthDay.getDate()).padStart(2, '0');
      const month = String(birthDay.getMonth() + 1).padStart(2, '0');
      const year = birthDay.getFullYear();
        birthdate = `${day}-${month}-${year}`;
      }
    }

    // Format gender
    let gender = '---';
    if (this.customer.Gender) {
      gender = this.customer.Gender === 'male' ? 'Nam' : 
               this.customer.Gender === 'female' ? 'Nữ' : 
               this.customer.Gender;
    }

    // Determine if customer has account (has email and FullName)
    const hasAccount = !!(this.customer.Email && this.customer.FullName);
    
    // Email consent - assume false for now (not in JSON)
    const emailConsent = false;

    // Normalize customer ID for display
    const normalizedCustomerID = this.normalizeCustomerID(this.customerId);
    
    this.customerData = {
      id: normalizedCustomerID,
      name: this.customer.FullName || '---',
      gender: gender,
      email: this.customer.Email || '---',
      birthdate: birthdate,
      phone: this.customer.Phone || '---',
      address: this.customer.Address || '---',
      memberTier: memberTier,
      customerType: customerType,
      joinDate: formattedDate,
      recentOrder: recentOrder,
      totalSpent: totalSpent,
      totalOrders: totalOrders,
      hasAccount: hasAccount,
      emailConsent: emailConsent
    };
    
    // If edit mode was requested from navigation, enter edit mode after data is loaded
    if (this.shouldEnterEditMode && !this.isEditMode) {
      console.log('🔄 Entering edit mode automatically after data load...');
      // Use setTimeout to ensure UI is ready
      setTimeout(() => {
        this.enterEditMode();
        this.shouldEnterEditMode = false; // Reset flag
      }, 100);
    }
  }
  
  /**
   * Enter edit mode - initialize editableData from customerData
   */
  private enterEditMode(): void {
    if (this.isEditMode) {
      return; // Already in edit mode
    }
    
    console.log('✏️ Entering edit mode...');
    
    // Map memberTier from database format to select value (if needed)
    let memberTierValue = 'bronze';
    if (this.customerData.memberTier === 'Vàng') {
      memberTierValue = 'gold';
    } else if (this.customerData.memberTier === 'Bạc') {
      memberTierValue = 'silver';
    } else if (this.customerData.memberTier === 'Đồng') {
      memberTierValue = 'bronze';
    }
    
    // Enter edit mode - copy current data to editable
    this.editableData = {
      name: this.customerData.name === '---' ? '' : this.customerData.name,
      email: this.customerData.email === '---' ? '' : this.customerData.email,
      phone: this.customerData.phone === '---' ? '' : this.customerData.phone,
      address: this.customerData.address === '---' ? '' : this.customerData.address,
      memberTier: memberTierValue,
      emailConsent: this.customerData.emailConsent,
      gender: this.customerData.gender === '---' ? '' : this.customerData.gender,
      birthdate: this.customerData.birthdate === '---' ? '' : this.customerData.birthdate
    };
    
    // Parse existing address if available
    this.parseAddress(this.customerData.address);
    
    this.isEditMode = true;
    console.log('✅ Edit mode activated');
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
  }

  /**
   * Go back to customers list
   */
  goBack(): void {
    if (this.isEditMode) {
      // If in edit mode, just cancel edit
      this.cancelEdit();
    } else {
      this.router.navigate(['/customers']);
    }
  }

  /**
   * View all orders
   */
  viewAllOrders(): void {
    // Navigate to orders page with customer filter
    this.router.navigate(['/orders'], { 
      queryParams: { customer: this.customer.user_id } 
    });
  }

  /**
   * Edit address - Enter edit mode
   */
  editAddress(): void {
    if (!this.isEditMode) {
      this.toggleEditMode();
    }
  }

  /**
   * Toggle edit mode
   */
  toggleEditMode(): void {
    if (!this.isEditMode) {
      this.enterEditMode();
    } else {
      // Cancel edit mode
      this.cancelEdit();
    }
  }

  /**
   * Parse existing address into components
   */
  parseAddress(address: string): void {
    // Reset selections
    this.selectedProvince = '';
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.streetAddress = '';
  }

  /**
   * Start adding new address
   */
  startAddingAddress(): void {
    this.isAddingNewAddress = true;
    this.editingAddressIndex = -1;
    this.selectedProvince = '';
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.streetAddress = '';
    this.districts = [];
    this.wards = [];
  }

  /**
   * Start editing address
   */
  startEditingAddress(index: number): void {
    this.isAddingNewAddress = false;
    this.editingAddressIndex = index;
    // Parse the existing address back to form (simplified - just clear for now)
    this.selectedProvince = '';
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.streetAddress = this.addresses[index].fullAddress;
  }

  /**
   * Save new or edited address
   */
  saveAddress(): void {
    const fullAddress = this.buildFullAddress();
    
    if (!fullAddress) {
      alert('Vui lòng nhập đầy đủ thông tin địa chỉ');
      return;
    }

    if (this.editingAddressIndex >= 0) {
      // Edit existing address
      this.addresses[this.editingAddressIndex].fullAddress = fullAddress;
    } else {
      // Add new address
      const isFirstAddress = this.addresses.length === 0;
      const newAddress = {
        id: Date.now(),
        fullAddress: fullAddress,
        isDefault: isFirstAddress // First address is default
      };
      
      if (isFirstAddress) {
        // First address - just add it
        this.addresses.push(newAddress);
      } else {
        // Not first address - add at the end (not default)
        this.addresses.push(newAddress);
      }
    }

    this.cancelAddressEdit();
  }

  /**
   * Cancel adding/editing address
   */
  cancelAddressEdit(): void {
    this.isAddingNewAddress = false;
    this.editingAddressIndex = -1;
    this.selectedProvince = '';
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.streetAddress = '';
    this.districts = [];
    this.wards = [];
  }

  /**
   * Set default address and move to top
   */
  setDefaultAddress(index: number): void {
    // Get the selected address
    const selectedAddress = this.addresses[index];
    
    // Set all addresses as non-default
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });
    
    // Set selected as default
    selectedAddress.isDefault = true;
    
    // Remove from current position
    this.addresses.splice(index, 1);
    
    // Insert at the beginning
    this.addresses.unshift(selectedAddress);
  }

  /**
   * Delete address
   */
  deleteAddress(index: number): void {
    if (confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) {
      const wasDefault = this.addresses[index].isDefault;
      this.addresses.splice(index, 1);
      
      // If deleted default, set first address as default
      if (wasDefault && this.addresses.length > 0) {
        this.addresses[0].isDefault = true;
      }
    }
  }

  /**
   * Get default address
   */
  getDefaultAddress(): any {
    return this.addresses.find(addr => addr.isDefault);
  }

  /**
   * On province change
   */
  onProvinceChange(): void {
    const province = this.provinces.find(p => p.code === this.selectedProvince);
    if (province) {
      this.districts = province.districts;
    } else {
      this.districts = [];
    }
    this.wards = [];
    this.selectedDistrict = '';
    this.selectedWard = '';
  }

  /**
   * On district change
   */
  onDistrictChange(): void {
    const district = this.districts.find(d => d.code === this.selectedDistrict);
    if (district) {
      this.wards = district.wards;
    } else {
      this.wards = [];
    }
    this.selectedWard = '';
  }

  /**
   * Build full address from components
   */
  buildFullAddress(): string {
    const parts: string[] = [];
    
    if (this.streetAddress) {
      parts.push(this.streetAddress);
    }
    
    if (this.selectedWard) {
      parts.push(this.selectedWard);
    }
    
    if (this.selectedDistrict) {
      const district = this.districts.find(d => d.code === this.selectedDistrict);
      if (district) {
        parts.push(district.name);
      }
    }
    
    if (this.selectedProvince) {
      const province = this.provinces.find(p => p.code === this.selectedProvince);
      if (province) {
        parts.push(province.name);
      }
    }
    
    return parts.join(', ');
  }

  /**
   * Save customer changes
   * Only updates basic information (name, email, phone, gender, birthdate, address)
   * Does NOT update member tier (CustomerTiering) - it's locked
   */
  saveCustomer(): void {
    // Normalize customer ID to CUSxxxxxx format
    const customerID = this.normalizeCustomerID(this.customerId);
    
    // Prepare update data - ONLY basic information (NO memberTier)
    const updateData: any = {
      fullName: this.editableData.name || '',
      email: this.editableData.email || '',
      phone: this.editableData.phone || '',
      gender: this.editableData.gender || '',
      birthDay: this.editableData.birthdate || '',
      address: this.buildFullAddress() || ''
    };
    
    // Map gender to database format
          if (updateData.gender === 'Nam') {
      updateData.gender = 'male';
          } else if (updateData.gender === 'Nữ') {
      updateData.gender = 'female';
    }
    
    // Format birthdate to ISO string if provided
    if (updateData.birthDay && updateData.birthDay !== '---' && updateData.birthDay !== '') {
      // Try to parse date from dd/mm/yyyy or dd-mm-yyyy format
      let dateObj: Date | null = null;
      if (updateData.birthDay.includes('/')) {
        const dateParts = updateData.birthDay.split('/');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1;
              const year = parseInt(dateParts[2]);
          dateObj = new Date(year, month, day);
        }
      } else if (updateData.birthDay.includes('-')) {
        const dateParts = updateData.birthDay.split('-');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1;
          const year = parseInt(dateParts[2]);
          dateObj = new Date(year, month, day);
        }
      }
      
      if (dateObj && !isNaN(dateObj.getTime())) {
        updateData.birthDay = dateObj.toISOString();
      } else {
        // If parsing fails, try direct Date constructor
        dateObj = new Date(updateData.birthDay);
        if (!isNaN(dateObj.getTime())) {
          updateData.birthDay = dateObj.toISOString();
        } else {
          delete updateData.birthDay; // Remove invalid date
        }
      }
    } else {
      delete updateData.birthDay; // Remove if empty
    }
    
    console.log('💾 Saving customer data (basic info only, NO member tier):', updateData);
    console.log('📱 CustomerID:', customerID);
    
    // Call API to update customer in MongoDB
    this.http.put(`http://localhost:3000/api/users/customer/${customerID}`, updateData).subscribe({
      next: (response: any) => {
        console.log('✅ Customer updated successfully in MongoDB:', response);
        
        // Check if update was successful
        if (response.success !== false) {
          // Exit edit mode first
          this.isEditMode = false;
          
          // Show success message
        alert('✅ Đã cập nhật thông tin khách hàng thành công!');
          
          // Reload customer data from MongoDB to get latest data
          // This ensures we have the most up-to-date data from the database
          // Reload will update customerData with fresh data from MongoDB
          console.log('🔄 Reloading customer data from MongoDB after update...');
          this.loadCustomerDetail();
        } else {
          // Handle case where backend returns success: false
          console.error('❌ Backend returned success: false', response);
          alert('❌ Lỗi khi cập nhật thông tin khách hàng: ' + (response.message || 'Lỗi không xác định'));
        }
      },
      error: (error) => {
        console.error('❌ Error updating customer:', error);
        console.error('❌ Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        
        const errorMessage = error.error?.message || error.error?.error || error.message || 'Lỗi không xác định';
        alert('❌ Lỗi khi cập nhật thông tin khách hàng: ' + errorMessage);
      }
    });
  }

  /**
   * Cancel edit mode
   */
  cancelEdit(): void {
    this.isEditMode = false;
    this.editableData = {};
    this.selectedProvince = '';
    this.selectedDistrict = '';
    this.selectedWard = '';
    this.streetAddress = '';
    this.districts = [];
    this.wards = [];
  }

  /**
   * View order detail
   */
  viewOrderDetail(orderId: string): void {
    // Navigate to order detail with state to know we came from customer detail
    this.router.navigate(['/orders', orderId], { 
      state: { 
        returnUrl: `/customers/${this.customerId}`,
        fromCustomerDetail: true 
      } 
    });
  }

  /**
   * Get status label
   */
  getStatusLabel(status: string): string {
    const labels: any = {
      'pending': 'Chờ xác nhận',
      'confirmed': 'Đã xác nhận',
      'processing': 'Đang xử lý',
      'shipping': 'Đang giao hàng',
      'delivered': 'Hoàn thành',
      'completed': 'Hoàn thành',
      'cancelled': 'Đã huỷ',
      'processing_return': 'Đang xử lý hoàn trả',
      'returning': 'Đang hoàn trả',
      'returned': 'Đã hoàn trả',
      'Pending': 'Chờ xác nhận',
      'Confirmed': 'Đã xác nhận',
      'Cancel Requested': 'Yêu cầu huỷ/hoàn tiền',
      'Return Requested': 'Yêu cầu huỷ/hoàn tiền',
      'Cancelled': 'Đã huỷ',
      'Refunded': 'Đã hoàn tiền',
      'Delivered': 'Hoàn thành'
    };
    return labels[status] || status || '---';
  }

  /**
   * Get status class
   */
  getStatusClass(status: string): string {
    const classes: any = {
      'pending': 'status-pending',
      'confirmed': 'status-confirmed',
      'processing': 'status-confirmed',
      'shipping': 'status-confirmed',
      'delivered': 'status-confirmed',
      'completed': 'status-confirmed',
      'cancelled': 'status-cancelled',
      'processing_return': 'status-refund-requested',
      'returning': 'status-refund-requested',
      'returned': 'status-refunded',
      'Pending': 'status-pending',
      'Confirmed': 'status-confirmed',
      'Cancel Requested': 'status-refund-requested',
      'Return Requested': 'status-refund-requested',
      'Cancelled': 'status-cancelled',
      'Refunded': 'status-refunded',
      'Delivered': 'status-confirmed'
    };
    return classes[status] || 'status-pending';
  }

  /**
   * Format order date
   */
  formatOrderDate(order: any): string {
    let date: Date;
    if (order.createdAt?.$date) {
      date = new Date(order.createdAt.$date);
    } else if (order.createdAt) {
      date = new Date(order.createdAt);
    } else if (order.order_date) {
      date = new Date(order.order_date);
    } else {
      return '---';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

