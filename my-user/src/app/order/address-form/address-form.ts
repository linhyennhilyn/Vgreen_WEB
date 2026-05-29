import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ScrollLockService } from '../../services/scroll-lock.service';
import { AuthService } from '../../services/auth.service';
import { AddressService } from '../../services/address.service';

export interface AddressInfo {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  ward: string;
  detail: string;
  notes?: string;
  deliveryMethod: 'standard' | 'express';
  isDefault?: boolean;
}

@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './address-form.html',
  styleUrl: './address-form.css',
})
export class AddressFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() addressInfo: AddressInfo = {
    fullName: '',
    phone: '',
    email: '',
    city: '',
    district: '',
    ward: '',
    detail: '',
    deliveryMethod: 'standard',
  };

  @Output() addressComplete = new EventEmitter<AddressInfo>();
  @Output() closeModal = new EventEmitter<void>();

  // Validation states
  errors: any = {};
  isSubmitting = false;

  // Checkbox state cho "Đặt làm địa chỉ mặc định"
  setAsDefault = false; // Mặc định không tick

  // Address data for dropdowns
  cities: any[] = [];
  districts: any[] = [];
  wards: any[] = [];

  // Filtered and sorted data for dropdowns
  filteredCities: any[] = [];
  filteredDistricts: any[] = [];
  filteredWards: any[] = [];

  // Search queries
  citySearchQuery: string = '';
  districtSearchQuery: string = '';
  wardSearchQuery: string = '';

  // Tree data loaded from JSON file
  private addressTree: any = null;

  // Custom select states
  showCityDropdown = false;
  showDistrictDropdown = false;
  showWardDropdown = false;

  isLoadingCities = false;
  isLoadingDistricts = false;
  isLoadingWards = false;

  constructor(
    private scrollLock: ScrollLockService,
    private authService: AuthService,
    private addressService: AddressService,
    private http: HttpClient
  ) {}

  // Mapping between provinces.json codes and tree_complete.json codes
  // Some provinces have different codes in the two files
  private provinceCodeMapping: { [key: string]: string } = {
    '30': '79', // HCM: provinces.json uses "30", tree_complete.json uses "79"
    '01': '01', // Hà Nội
    '48': '48', // Đà Nẵng
    // Add more mappings as needed
  };

  ngOnChanges(changes: SimpleChanges) {
    // Được gọi khi @Input() thay đổi, VÀ trước ngOnInit
    if (changes['addressInfo']) {
      console.log('🔄 [AddressForm] AddressInfo changed:', this.addressInfo);
      // Điền thông tin tự động khi nhận được addressInfo từ parent
      this.fillUserInfo();

      // Khôi phục dữ liệu form khi addressInfo thay đổi (khi edit)
      // Đợi một chút để đảm bảo cities đã được load
      if (this.addressInfo.city || this.addressInfo.district || this.addressInfo.ward) {
        setTimeout(() => {
          this.restoreFormData();
        }, 200);
      }
    }
  }

  ngOnInit() {
    // Reset checkbox về mặc định khi mở form
    this.setAsDefault = false;

    // Load address data từ MongoDB tree - giống admin (63 tỉnh thành)
    this.loadAddressData();

    // Điền thông tin lần đầu khi component khởi tạo
    this.fillUserInfo();

    // Khôi phục dữ liệu khi form được mở lại
    console.log('AddressForm ngOnInit - addressInfo:', this.addressInfo);
    this.restoreFormData();

    // Lock scroll khi modal mở
    this.scrollLock.lock();
  }

  /**
   * Load address data từ MongoDB collection tree_complete - giống admin
   * Xây dựng provinces với districts và wards nested để có đủ 63 tỉnh thành
   */
  private loadAddressData(): void {
    this.isLoadingCities = true;
    console.log('🔄 Loading address data from MongoDB tree_complete collection (63 tỉnh thành)...');

    // Load tree data from MongoDB API
    this.http.get<any>('http://localhost:3000/api/tree_complete').subscribe({
      next: (treeData: any) => {
        console.log('✅ Loaded tree_complete from MongoDB API');
        console.log(
          '📦 treeData structure:',
          Array.isArray(treeData) ? 'array' : typeof treeData,
          Array.isArray(treeData) ? `length: ${treeData.length}` : ''
        );

        // tree_complete từ MongoDB là array chứa một object với structure: [{ tree: {...} }]
        // Hoặc có thể là array trực tiếp: [{...}]
        // Lấy phần tử đầu tiên của array
        const firstItem = Array.isArray(treeData) && treeData.length > 0 ? treeData[0] : treeData;

        // Nếu có field 'tree', lấy dữ liệu từ đó (khi import từ JSON vào MongoDB)
        // Nếu không, dùng trực tiếp firstItem (khi dữ liệu được lưu trực tiếp)
        const provincesObject = firstItem?.tree || firstItem;

        if (!provincesObject) {
          console.error('❌ No provinces data found in tree_complete response');
          this.isLoadingCities = false;
          this.cities = [];
          this.filteredCities = [];
          return;
        }

        console.log('📦 provincesObject keys:', Object.keys(provincesObject).slice(0, 5));

        // Process provinces data
        this.processProvincesData(provincesObject);
      },
      error: (error: any) => {
        console.error('❌ Error loading tree_complete from MongoDB:', error);
        console.log('🔄 Trying fallback: loading from JSON file...');

        // Fallback: Load từ JSON file nếu API thất bại
        this.http.get<any>('data/address/tree_complete.json').subscribe({
          next: (jsonData: any) => {
            console.log('✅ Fallback: Loaded tree_complete from JSON file');

            // Xử lý tương tự như khi load từ API
            const firstItem =
              Array.isArray(jsonData) && jsonData.length > 0 ? jsonData[0] : jsonData;
            const provincesObject = firstItem?.tree || firstItem;

            if (!provincesObject) {
              console.error('❌ No provinces data found in JSON file');
              this.isLoadingCities = false;
              this.cities = [];
              this.filteredCities = [];
              return;
            }

            // Process provincesObject tương tự như trên
            this.processProvincesData(provincesObject);
          },
          error: (jsonError: any) => {
            console.error('❌ Error loading tree_complete from JSON file:', jsonError);
            this.isLoadingCities = false;
            this.addressTree = null;
            this.cities = [];
            this.filteredCities = [];
          },
        });
      },
    });
  }

  /**
   * Process provinces data từ provincesObject và map thành cities array
   */
  private processProvincesData(provincesObject: any): void {
    // Convert object structure to array structure for provinces (giống admin)
    // Filter out null/undefined provinces
    this.cities = Object.values(provincesObject)
      .map((province: any) => {
        const districts: any[] = [];

        // Convert districts object to array
        if (province['quan-huyen']) {
          Object.values(province['quan-huyen']).forEach((district: any) => {
            const wards: any[] = [];

            // Convert wards object to array
            if (district['xa-phuong']) {
              Object.values(district['xa-phuong']).forEach((ward: any) => {
                // Only add ward if it has a valid name
                if (ward && ward.name && ward.name.trim() !== '') {
                  wards.push({
                    id: ward.slug || ward.code || '',
                    code: ward.code || '',
                    name: ward.name || '',
                    fullName: ward.name_with_type || ward.name || '',
                    slug: ward.slug || '',
                  });
                }
              });
            }

            // Only add district if it has a valid name
            if (district && district.name && district.name.trim() !== '') {
              districts.push({
                id: district.slug || district.code || '',
                code: district.code || '',
                name: district.name || '',
                fullName: district.name_with_type || district.name || '',
                slug: district.slug || '',
                type: district.type || '',
                wards: wards.filter((w: any) => w && w.name && w.name.trim() !== ''), // Filter out empty wards
              });
            }
          });
        }

        // Only return province if it has a valid name
        if (province && province.name && province.name.trim() !== '') {
          return {
            id: province.slug || province.code || '',
            code: province.code || '',
            name: province.name || '',
            fullName: province.name_with_type || province.name || '',
            slug: province.slug || '',
            type: province.type || 'province',
            districts: districts.filter((d: any) => d && d.name && d.name.trim() !== ''), // Filter out empty districts
          };
        }
        return null;
      })
      .filter((province: any) => province !== null); // Remove null provinces

    console.log(
      `✅ Mapped ${this.cities.length} provinces with districts and wards from tree_complete data`
    );

    // Filter out cities with empty or invalid names
    this.cities = this.cities.filter((city) => city && city.name && city.name.trim() !== '');

    // Sort cities alphabetically and initialize filtered list
    this.cities.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    this.filteredCities = [...this.cities];

    // Kiểm tra số lượng provinces - phải có 63 tỉnh thành
    if (this.cities.length < 63) {
      console.warn(`⚠️ Chỉ có ${this.cities.length} tỉnh thành được load, mong đợi 63 tỉnh thành!`);
    } else if (this.cities.length === 63) {
      console.log('✅ Đã load đủ 63 tỉnh thành từ tree_complete!');
    } else {
      console.log(`ℹ️ Đã load ${this.cities.length} tỉnh thành (có thể nhiều hơn 63)`);
    }

    // Log summary
    const provincesWithDistricts = this.cities.filter(
      (p: any) => p.districts && p.districts.length > 0
    ).length;
    const totalDistricts = this.cities.reduce((sum, p: any) => sum + (p.districts?.length || 0), 0);
    const totalWards = this.cities.reduce(
      (sum, p: any) =>
        sum +
        (p.districts?.reduce((dSum: number, d: any) => dSum + (d.wards?.length || 0), 0) || 0),
      0
    );

    console.log(
      `📊 Built ${provincesWithDistricts}/${this.cities.length} provinces, ${totalDistricts} districts, ${totalWards} wards`
    );

    this.isLoadingCities = false;
    // Lưu provincesObject để dễ sử dụng sau này
    this.addressTree = provincesObject;

    // After loading, restore form data if needed
    // Đợi một chút để đảm bảo cities array đã được set
    setTimeout(() => {
      if (this.addressInfo.city || this.addressInfo.district || this.addressInfo.ward) {
        this.restoreFormData();
      }
    }, 100);
  }

  ngOnDestroy() {
    // Unlock scroll khi modal đóng
    this.scrollLock.unlock();
  }

  // Tự động điền thông tin từ tài khoản đăng nhập
  private fillUserInfo() {
    // Force reload user từ localStorage trước (giống personal-information.ts)
    this.authService.reloadUserFromStorage();

    // Lấy user từ AuthService
    let currentUser: any = this.authService.getCurrentUser();

    // Nếu không có, thử lấy trực tiếp từ localStorage
    if (!currentUser) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          currentUser = JSON.parse(userStr);
          console.log(' [AddressForm] Lấy user từ localStorage:', currentUser);
        } catch (error) {
          console.error(' [AddressForm] Lỗi parse user:', error);
        }
      }
    }

    if (!currentUser) {
      console.log(' [AddressForm] Không có user đăng nhập');
      return;
    }

    console.log(' [AddressForm] Current user:', currentUser);
    console.log(' [AddressForm] Current addressInfo:', this.addressInfo);

    // Chỉ điền nếu các trường còn trống
    if (!this.addressInfo.phone || this.addressInfo.phone.trim() === '') {
      // Thử nhiều key khác nhau (giống personal-information.ts)
      this.addressInfo.phone =
        currentUser.phoneNumber || currentUser.Phone || currentUser.phone || '';
      console.log(' [AddressForm] Đã điền số điện thoại:', this.addressInfo.phone);
    }

    if (!this.addressInfo.fullName || this.addressInfo.fullName.trim() === '') {
      this.addressInfo.fullName =
        currentUser.fullName || currentUser.FullName || currentUser.name || '';
      console.log(' [AddressForm] Đã điền họ tên:', this.addressInfo.fullName);
    }

    if (!this.addressInfo.email || this.addressInfo.email.trim() === '') {
      this.addressInfo.email = currentUser.email || currentUser.Email || '';
      console.log(' [AddressForm] Đã điền email:', this.addressInfo.email);
    }

    console.log(' [AddressForm] Final addressInfo:', this.addressInfo);
  }

  private restoreFormData() {
    // Nếu đã có city được chọn, khôi phục districts
    if (this.addressInfo.city) {
      console.log('Restoring districts for city:', this.addressInfo.city);
      // Wait for cities to load if not loaded yet
      if (this.cities.length === 0) {
        setTimeout(() => this.restoreFormData(), 100);
        return;
      }
      this.loadDistricts();

      // Nếu đã có district được chọn, khôi phục wards
      if (this.addressInfo.district) {
        console.log('Restoring wards for district:', this.addressInfo.district);
        this.loadWards();
      }
    }
  }

  private loadDistricts() {
    if (!this.addressInfo.city) {
      this.districts = [];
      return;
    }

    // Find city by id (slug) or code - giống admin
    const selectedCity = this.cities.find(
      (c) =>
        c.id === this.addressInfo.city ||
        c.slug === this.addressInfo.city ||
        c.code === this.addressInfo.city
    );

    if (!selectedCity) {
      console.warn('⚠️ City not found:', this.addressInfo.city);
      this.districts = [];
      return;
    }

    console.log(`🔍 Loading districts for city: ${selectedCity.name}`);

    // Load districts from nested structure (giống admin)
    if (selectedCity.districts && selectedCity.districts.length > 0) {
      this.districts = selectedCity.districts.filter(
        (d: any) => d && d.name && d.name.trim() !== ''
      );
      console.log(`✅ Loaded ${this.districts.length} districts for city: ${selectedCity.name}`);
    } else {
      console.warn('⚠️ No districts found for city:', selectedCity.name);
      this.districts = [];
    }
  }

  private loadWards() {
    if (!this.addressInfo.district || !this.addressInfo.city) {
      this.wards = [];
      return;
    }

    // Find district by id (slug) or code - giống admin
    const selectedDistrict = this.districts.find(
      (d) =>
        d.id === this.addressInfo.district ||
        d.slug === this.addressInfo.district ||
        d.code === this.addressInfo.district
    );

    if (!selectedDistrict) {
      console.warn('⚠️ District not found:', this.addressInfo.district);
      this.wards = [];
      return;
    }

    console.log(`🔍 Loading wards for district: ${selectedDistrict.name}`);

    // Load wards from nested structure (giống admin)
    if (selectedDistrict.wards && selectedDistrict.wards.length > 0) {
      // Wards can be array of strings or array of objects
      this.wards = selectedDistrict.wards
        .map((ward: any) => {
          if (typeof ward === 'string') {
            // Only return if string is not empty
            if (ward && ward.trim() !== '') {
              return { code: '', name: ward, fullName: ward, slug: '', id: ward };
            }
            return null;
          }
          // Only return if ward has a valid name
          if (ward && ward.name && ward.name.trim() !== '') {
            return {
              id: ward.slug || ward.code || ward.id || '',
              code: ward.code || '',
              name: ward.name || '',
              fullName: ward.fullName || ward.name || '',
              slug: ward.slug || '',
            };
          }
          return null;
        })
        .filter((ward: any) => ward !== null); // Remove null wards

      // Sort wards alphabetically
      this.wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      // Reset search and update filtered list
      this.wardSearchQuery = '';
      this.filterWards();
      console.log(`✅ Loaded ${this.wards.length} wards for district: ${selectedDistrict.name}`);
    } else {
      console.warn('⚠️ No wards found for district:', selectedDistrict.name);
      this.wards = [];
      this.filteredWards = [];
    }
  }

  onCityChange() {
    // Giống admin: Load districts từ nested structure
    console.log('🔄 [AddressForm] City changed:', this.addressInfo.city);

    if (!this.addressInfo.city) {
      this.districts = [];
      this.wards = [];
      return;
    }

    const selectedCity = this.cities.find(
      (c) =>
        c.id === this.addressInfo.city ||
        c.slug === this.addressInfo.city ||
        c.code === this.addressInfo.city
    );

    if (!selectedCity) {
      console.warn('⚠️ [AddressForm] City not found:', this.addressInfo.city);
      console.log(
        'Available cities:',
        this.cities.slice(0, 5).map((c) => ({ id: c.id, slug: c.slug, name: c.name }))
      );
      this.districts = [];
      this.wards = [];
      return;
    }

    console.log('📍 [AddressForm] Found city:', selectedCity.name);
    console.log('📍 [AddressForm] City districts count:', selectedCity.districts?.length || 0);

    if (selectedCity.districts && selectedCity.districts.length > 0) {
      // Filter out districts with empty or invalid names
      this.districts = selectedCity.districts.filter(
        (d: any) => d && d.name && d.name.trim() !== ''
      );
      // Sort districts alphabetically
      this.districts.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      // Reset search and update filtered list
      this.districtSearchQuery = '';
      this.filterDistricts();
      console.log(
        `✅ [AddressForm] Loaded ${this.districts.length} districts for ${selectedCity.name}`
      );
    } else {
      this.districts = [];
      this.filteredDistricts = [];
      console.warn('⚠️ [AddressForm] City has no districts:', selectedCity.name);
    }

    // Reset district and ward when city changes
    this.addressInfo.district = '';
    this.addressInfo.ward = '';
    this.wards = [];
    this.filteredWards = [];
    this.districtSearchQuery = '';
    this.wardSearchQuery = '';
  }

  onDistrictChange() {
    // Giống admin: Load wards từ nested structure
    console.log('🔄 District changed:', this.addressInfo.district);
    const selectedDistrict = this.districts.find(
      (d) =>
        d.id === this.addressInfo.district ||
        d.slug === this.addressInfo.district ||
        d.code === this.addressInfo.district
    );

    if (selectedDistrict && selectedDistrict.wards) {
      // Wards can be array of strings or array of objects
      this.wards = selectedDistrict.wards
        .map((ward: any) => {
          if (typeof ward === 'string') {
            // Only return if string is not empty
            if (ward && ward.trim() !== '') {
              return { code: '', name: ward, fullName: ward, slug: '', id: ward };
            }
            return null;
          }
          // Only return if ward has a valid name
          if (ward && ward.name && ward.name.trim() !== '') {
            return {
              id: ward.slug || ward.code || ward.id || '',
              code: ward.code || '',
              name: ward.name || '',
              fullName: ward.fullName || ward.name || '',
              slug: ward.slug || '',
            };
          }
          return null;
        })
        .filter((ward: any) => ward !== null); // Remove null wards

      // Sort wards alphabetically
      this.wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      // Reset search and update filtered list
      this.wardSearchQuery = '';
      this.filterWards();
      console.log(`✅ Loaded ${this.wards.length} wards`);
    } else {
      this.wards = [];
      this.filteredWards = [];
      console.warn('⚠️ No wards found for district');
    }

    // Reset ward when district changes
    this.addressInfo.ward = '';
  }

  // City dropdown methods
  toggleCityDropdown() {
    this.showCityDropdown = !this.showCityDropdown;
    if (this.showCityDropdown) {
      // Reset search when opening dropdown
      this.citySearchQuery = '';
      this.filterCities();
    }
  }

  closeCityDropdown() {
    this.showCityDropdown = false;
  }

  selectCity(city: any) {
    // Use slug as id for consistency with MongoDB (hcm, ha-noi, etc.)
    this.addressInfo.city = city.slug || city.id;

    console.log('📍 [AddressForm] Selected city:', city.name, 'slug:', this.addressInfo.city);

    // Call onCityChange to load districts (giống admin)
    this.onCityChange();

    this.closeCityDropdown();
  }

  getSelectedCityName(): string {
    const selectedCity = this.cities.find(
      (c) =>
        c.id === this.addressInfo.city ||
        c.slug === this.addressInfo.city ||
        c.code === this.addressInfo.city
    );
    return selectedCity ? selectedCity.name : '';
  }

  // Custom select methods
  toggleDistrictDropdown() {
    if (!this.addressInfo.city) return;
    this.showDistrictDropdown = !this.showDistrictDropdown;
    if (this.showDistrictDropdown) {
      // Reset search when opening dropdown
      this.districtSearchQuery = '';
      this.filterDistricts();
    }
  }

  closeDistrictDropdown() {
    this.showDistrictDropdown = false;
  }

  selectDistrict(district: any) {
    if (!this.addressInfo.city) return;

    // Use slug as id for consistency with MongoDB
    this.addressInfo.district = district.slug || district.id;

    // Call onDistrictChange to load wards (giống admin)
    this.onDistrictChange();

    this.closeDistrictDropdown();
  }

  getSelectedDistrictName(): string {
    const selectedDistrict = this.districts.find(
      (d) =>
        d.id === this.addressInfo.district ||
        d.slug === this.addressInfo.district ||
        d.code === this.addressInfo.district
    );
    return selectedDistrict ? selectedDistrict.name : '';
  }

  // Ward dropdown methods
  toggleWardDropdown() {
    if (!this.addressInfo.district) return;
    this.showWardDropdown = !this.showWardDropdown;
    if (this.showWardDropdown) {
      // Reset search when opening dropdown
      this.wardSearchQuery = '';
      this.filterWards();
    }
  }

  closeWardDropdown() {
    this.showWardDropdown = false;
  }

  selectWard(ward: any) {
    if (!this.addressInfo.district) return;
    // Use slug as id for consistency with MongoDB
    this.addressInfo.ward = ward.slug || ward.id;
    this.closeWardDropdown();
  }

  getSelectedWardName(): string {
    const selectedWard = this.wards.find(
      (w) =>
        w.id === this.addressInfo.ward ||
        w.slug === this.addressInfo.ward ||
        w.code === this.addressInfo.ward
    );
    return selectedWard ? selectedWard.name : '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select')) {
      this.closeCityDropdown();
      this.closeDistrictDropdown();
      this.closeWardDropdown();
    }
  }

  // Các phương thức xác thực thời gian thực
  onFullNameInput() {
    // Xóa lỗi khi người dùng bắt đầu nhập
    if (this.errors.fullName) {
      delete this.errors.fullName;
    }
  }

  validateFullName() {
    if (!this.addressInfo.fullName.trim()) {
      this.errors.fullName = 'Họ và tên là bắt buộc';
    } else if (!/^[a-zA-ZÀ-ỹ\s\-']+$/.test(this.addressInfo.fullName)) {
      this.errors.fullName = 'Tên không gồm ký tự đặc biệt';
    } else {
      delete this.errors.fullName;
    }
  }

  onPhoneInput() {
    // Xóa lỗi khi người dùng bắt đầu nhập
    if (this.errors.phone) {
      delete this.errors.phone;
    }
  }

  validatePhone() {
    if (!this.addressInfo.phone.trim()) {
      this.errors.phone = 'Số điện thoại là bắt buộc';
    } else if (!/^(\+84|0)[0-9]{9,10}$/.test(this.addressInfo.phone)) {
      this.errors.phone = 'Số điện thoại không hợp lệ';
    } else {
      delete this.errors.phone;
    }
  }

  onEmailInput() {
    // Xóa lỗi khi người dùng bắt đầu nhập
    if (this.errors.email) {
      delete this.errors.email;
    }
  }

  validateEmail() {
    // Email is optional, but validate format if provided
    if (this.addressInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.addressInfo.email)) {
      this.errors.email = 'Email không hợp lệ';
    } else {
      delete this.errors.email;
    }
  }

  // Getter methods for template validation
  get isFullNameValid(): boolean {
    return (
      !this.errors.fullName &&
      !!this.addressInfo.fullName.trim() &&
      /^[a-zA-ZÀ-ỹ\s\-']+$/.test(this.addressInfo.fullName)
    );
  }

  get isPhoneValid(): boolean {
    return (
      !this.errors.phone &&
      !!this.addressInfo.phone.trim() &&
      /^(\+84|0)[0-9]{9,10}$/.test(this.addressInfo.phone)
    );
  }

  get isEmailValid(): boolean {
    return (
      !this.errors.email &&
      !!this.addressInfo.email.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.addressInfo.email)
    );
  }

  /**
   * Kiểm tra xem tất cả các trường bắt buộc đã được điền và hợp lệ chưa
   * Dùng để disable nút "Hoàn thành"
   */
  isFormValid(): boolean {
    // Kiểm tra fullName: phải có và hợp lệ
    const isFullNameValid: boolean =
      !!this.addressInfo.fullName &&
      this.addressInfo.fullName.trim() !== '' &&
      /^[a-zA-ZÀ-ỹ\s\-']+$/.test(this.addressInfo.fullName);

    // Kiểm tra phone: phải có và hợp lệ
    const isPhoneValid: boolean =
      !!this.addressInfo.phone &&
      this.addressInfo.phone.trim() !== '' &&
      /^(\+84|0)[0-9]{9,10}$/.test(this.addressInfo.phone);

    // Kiểm tra email: nếu có thì phải hợp lệ (optional)
    const isEmailValid: boolean =
      !this.addressInfo.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.addressInfo.email);

    // Kiểm tra địa chỉ: city, district, ward, detail
    const isCityValid: boolean =
      !!this.addressInfo.city &&
      typeof this.addressInfo.city === 'string' &&
      this.addressInfo.city.trim() !== '';
    const isDistrictValid: boolean =
      !!this.addressInfo.district &&
      typeof this.addressInfo.district === 'string' &&
      this.addressInfo.district.trim() !== '';
    const isWardValid: boolean =
      !!this.addressInfo.ward &&
      typeof this.addressInfo.ward === 'string' &&
      this.addressInfo.ward.trim() !== '';
    // Kiểm tra detail: phải có, >= 5 ký tự, và phải chứa cả chữ và số
    const detailTrimmed = this.addressInfo.detail?.trim() || '';
    const hasLetters = /[a-zA-ZÀ-ỹ]/.test(detailTrimmed);
    const hasNumbers = /[0-9]/.test(detailTrimmed);
    const isDetailValid: boolean =
      !!this.addressInfo.detail &&
      typeof this.addressInfo.detail === 'string' &&
      detailTrimmed !== '' &&
      detailTrimmed.length >= 5 &&
      hasLetters &&
      hasNumbers;

    return (
      isFullNameValid &&
      isPhoneValid &&
      isEmailValid &&
      isCityValid &&
      isDistrictValid &&
      isWardValid &&
      isDetailValid
    );
  }

  validateForm(): boolean {
    this.errors = {};

    // Name validation
    if (!this.addressInfo.fullName.trim()) {
      this.errors.fullName = 'Họ và tên là bắt buộc';
    } else if (!/^[a-zA-ZÀ-ỹ\s\-']+$/.test(this.addressInfo.fullName)) {
      this.errors.fullName = 'Tên không gồm ký tự đặc biệt';
    }

    // Phone validation
    if (!this.addressInfo.phone.trim()) {
      this.errors.phone = 'Số điện thoại là bắt buộc';
    } else if (!/^(\+84|0)[0-9]{9,10}$/.test(this.addressInfo.phone)) {
      this.errors.phone = 'Số điện thoại không hợp lệ';
    }

    // Email validation (optional but validate format if provided)
    if (this.addressInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.addressInfo.email)) {
      this.errors.email = 'Email không hợp lệ';
    }

    // Address validation
    if (!this.addressInfo.city) {
      this.errors.city = 'Vui lòng chọn tỉnh/thành phố';
    }
    if (!this.addressInfo.district) {
      this.errors.district = 'Vui lòng chọn quận/huyện';
    }
    if (!this.addressInfo.ward) {
      this.errors.ward = 'Vui lòng chọn phường/xã';
    }
    const detailTrimmed = this.addressInfo.detail?.trim() || '';
    if (!detailTrimmed) {
      this.errors.detail = 'Địa chỉ cụ thể là bắt buộc';
    } else if (detailTrimmed.length < 5) {
      this.errors.detail = 'Địa chỉ phải có ít nhất 5 ký tự';
    } else {
      // Kiểm tra phải chứa cả chữ và số
      const hasLetters = /[a-zA-ZÀ-ỹ]/.test(detailTrimmed);
      const hasNumbers = /[0-9]/.test(detailTrimmed);
      if (!hasLetters || !hasNumbers) {
        this.errors.detail = 'Địa chỉ phải chứa cả chữ và số (ví dụ: 123 Nguyễn Văn A)';
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit() {
    if (this.validateForm()) {
      this.isSubmitting = true;

      // Logic xử lý isDefault:
      // 1. Nếu là địa chỉ đầu tiên (chưa có địa chỉ nào) tự động set isDefault = true
      // 2. Nếu checkbox được tick set isDefault = true
      // 3. Nếu không phải địa chỉ đầu tiên và không tick set isDefault = false

      const currentAddresses = this.addressService.getAddresses();
      const isFirstAddress = currentAddresses.length === 0;

      if (isFirstAddress) {
        // Địa chỉ đầu tiên luôn là mặc định, dù có tick hay không
        this.addressInfo.isDefault = true;
      } else if (this.setAsDefault) {
        // Checkbox được tick set isDefault = true
        this.addressInfo.isDefault = true;
      } else {
        // Không phải địa chỉ đầu tiên và không tick set isDefault = false
        this.addressInfo.isDefault = false;
      }

      // Simulate API call
      setTimeout(() => {
        this.addressComplete.emit(this.addressInfo);
        this.isSubmitting = false;
      }, 1000);
    }
  }

  // Clear methods for input fields
  clearFullName(inputElement: HTMLInputElement) {
    this.addressInfo.fullName = '';
    this.errors.fullName = '';
    inputElement.focus();
  }

  clearPhone(inputElement: HTMLInputElement) {
    this.addressInfo.phone = '';
    this.errors.phone = '';
    inputElement.focus();
  }

  clearEmail(inputElement: HTMLInputElement) {
    this.addressInfo.email = '';
    this.errors.email = '';
    inputElement.focus();
  }

  clearDetail(inputElement: HTMLInputElement) {
    this.addressInfo.detail = '';
    this.errors.detail = '';
    inputElement.focus();
  }

  // Validate detail address field
  validateDetail(): void {
    const detailTrimmed = this.addressInfo.detail?.trim() || '';
    if (!detailTrimmed) {
      this.errors.detail = 'Địa chỉ cụ thể là bắt buộc';
    } else if (detailTrimmed.length < 5) {
      this.errors.detail = 'Địa chỉ phải có ít nhất 5 ký tự';
    } else {
      // Kiểm tra phải chứa cả chữ và số
      const hasLetters = /[a-zA-ZÀ-ỹ]/.test(detailTrimmed);
      const hasNumbers = /[0-9]/.test(detailTrimmed);
      if (!hasLetters || !hasNumbers) {
        this.errors.detail = 'Địa chỉ phải chứa cả chữ và số (ví dụ: 123 Nguyễn Văn A)';
      } else {
        this.errors.detail = '';
      }
    }
  }

  // Clear detail error when user types
  onDetailInput(): void {
    if (this.errors.detail) {
      // Clear error when user starts typing
      const detailTrimmed = this.addressInfo.detail?.trim() || '';
      if (detailTrimmed.length >= 5) {
        const hasLetters = /[a-zA-ZÀ-ỹ]/.test(detailTrimmed);
        const hasNumbers = /[0-9]/.test(detailTrimmed);
        if (hasLetters && hasNumbers) {
          this.errors.detail = '';
        }
      }
    }
  }

  onClose() {
    // Reset checkbox khi đóng modal
    this.setAsDefault = false;
    // Reset search queries
    this.citySearchQuery = '';
    this.districtSearchQuery = '';
    this.wardSearchQuery = '';
    this.closeModal.emit();
  }

  // Filter methods
  filterCities() {
    if (!this.citySearchQuery.trim()) {
      // Filter out cities with empty or invalid names
      this.filteredCities = this.cities.filter(
        (city) => city && city.name && city.name.trim() !== ''
      );
    } else {
      const query = this.citySearchQuery.toLowerCase().trim();
      this.filteredCities = this.cities.filter(
        (city) =>
          city &&
          city.name &&
          city.name.trim() !== '' &&
          (city.name.toLowerCase().includes(query) || city.fullName?.toLowerCase().includes(query))
      );
    }
  }

  filterDistricts() {
    if (!this.districtSearchQuery.trim()) {
      // Filter out districts with empty or invalid names
      this.filteredDistricts = this.districts.filter(
        (district) => district && district.name && district.name.trim() !== ''
      );
    } else {
      const query = this.districtSearchQuery.toLowerCase().trim();
      this.filteredDistricts = this.districts.filter(
        (district) =>
          district &&
          district.name &&
          district.name.trim() !== '' &&
          (district.name.toLowerCase().includes(query) ||
            district.fullName?.toLowerCase().includes(query))
      );
    }
  }

  filterWards() {
    if (!this.wardSearchQuery.trim()) {
      // Filter out wards with empty or invalid names
      this.filteredWards = this.wards.filter(
        (ward) => ward && ward.name && ward.name.trim() !== ''
      );
    } else {
      const query = this.wardSearchQuery.toLowerCase().trim();
      this.filteredWards = this.wards.filter(
        (ward) =>
          ward &&
          ward.name &&
          ward.name.trim() !== '' &&
          (ward.name.toLowerCase().includes(query) || ward.fullName?.toLowerCase().includes(query))
      );
    }
  }

  onCitySearchInput() {
    this.filterCities();
  }

  onDistrictSearchInput() {
    this.filterDistricts();
  }

  onWardSearchInput() {
    this.filterWards();
  }

  clearCitySearch() {
    this.citySearchQuery = '';
    this.filterCities();
  }

  clearDistrictSearch() {
    this.districtSearchQuery = '';
    this.filterDistricts();
  }

  clearWardSearch() {
    this.wardSearchQuery = '';
    this.filterWards();
  }
}
