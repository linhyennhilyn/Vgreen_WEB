import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';

export interface AddressInfo {
  _id?: string;
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
  createdAt?: Date;
}

export interface UserAddress {
  _id?: string;
  CustomerID: string;
  addresses: AddressInfo[];
}

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private apiUrl = 'http://localhost:3000/api/address';
  private addressesSubject = new BehaviorSubject<AddressInfo[]>([]);
  public addresses$ = this.addressesSubject.asObservable();
  private currentCustomerID: string | null = null;
  private addressTree: any = null; // Cache for tree_complete collection data
  private addressTreeLoaded: boolean = false; // Flag to track if addressTree is loaded

  constructor(private http: HttpClient) {
    // Load address tree data for Vietnamese name formatting
    this.loadAddressTree();
    // Load CustomerID from localStorage if exists
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        console.log(' [AddressService] User object:', user);

        // Lấy CustomerID trực tiếp
        this.currentCustomerID = user.CustomerID || null;
        console.log(' [AddressService] CustomerID:', this.currentCustomerID);

        if (this.currentCustomerID) {
          this.loadAddressesFromServer(this.currentCustomerID);
        } else {
          console.warn(' [AddressService] No CustomerID found:', user);
        }
      } catch (error) {
        console.error(' [AddressService] Error loading user info:', error);
      }
    } else {
      console.warn(' [AddressService] Không tìm thấy localStorage["user"]');
    }
  }

  // Set current user and load their addresses
  setCurrentUser(customerID: string): void {
    this.currentCustomerID = customerID;
    this.loadAddressesFromServer(customerID);
  }

  // Reload CustomerID from localStorage (gọi khi cần)
  reloadCustomerID(): void {
    console.log(' [AddressService.reloadCustomerID] START');
    const userInfo = localStorage.getItem('user');
    console.log(' - localStorage["user"]:', userInfo);

    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        console.log(' - Parsed user:', user);
        console.log(' - user.CustomerID:', user.CustomerID);

        this.currentCustomerID = user.CustomerID || null;
        console.log(
          ' [AddressService.reloadCustomerID] Set currentCustomerID to:',
          this.currentCustomerID
        );

        if (this.currentCustomerID) {
          console.log(' - Loading addresses from server...');
          this.loadAddressesFromServer(this.currentCustomerID);
        } else {
          console.warn(' [AddressService.reloadCustomerID] No CustomerID found');
        }
      } catch (error) {
        console.error(' [AddressService.reloadCustomerID] Error parsing user:', error);
      }
    } else {
      console.warn(' [AddressService.reloadCustomerID] No user in localStorage');
    }
  }

  // Load addresses from server
  private loadAddressesFromServer(customerID: string): void {
    this.http
      .get<any>(`${this.apiUrl}/${customerID}`)
      .pipe(
        map((response) => {
          if (response.success) {
            this.addressesSubject.next(response.data.addresses || []);
          }
        }),
        catchError((error) => {
          console.error('Error loading addresses from server:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  // Get current addresses
  getAddresses(): AddressInfo[] {
    return this.addressesSubject.value;
  }

  // Reload addresses from server
  reloadAddresses(customerID?: string): Observable<UserAddress> {
    const cid = customerID || this.currentCustomerID;
    if (!cid) {
      return of({ CustomerID: '', addresses: [] });
    }

    return this.http.get<any>(`${this.apiUrl}/${cid}`).pipe(
      map((response) => {
        if (response.success) {
          this.addressesSubject.next(response.data.addresses || []);
          return response.data;
        }
        return { CustomerID: cid, addresses: [] };
      }),
      catchError((error) => {
        console.error('Error reloading addresses:', error);
        return of({ CustomerID: cid, addresses: [] });
      })
    );
  }

  // Add new address
  addAddress(address: AddressInfo, customerID?: string): Observable<boolean> {
    console.log(' [AddressService.addAddress] START');
    console.log(' - Received customerID param:', customerID);
    console.log(' - Current this.currentCustomerID:', this.currentCustomerID);
    console.log(' - Address data:', address);

    const cid = customerID || this.currentCustomerID;
    console.log(' - Final cid to use:', cid);

    if (!cid) {
      console.error(' [AddressService.addAddress] No CustomerID available');
      console.error(' - customerID param:', customerID);
      console.error(' - this.currentCustomerID:', this.currentCustomerID);

      // Debug localStorage
      console.error(' - localStorage["user"]:', localStorage.getItem('user'));
      console.error(' - localStorage keys:', Object.keys(localStorage));

      return of(false);
    }

    console.log(' [AddressService.addAddress] Sending request to:', `${this.apiUrl}/${cid}/add`);

    return this.http.post<any>(`${this.apiUrl}/${cid}/add`, address).pipe(
      map((response) => {
        console.log('� [AddressService.addAddress] Response:', response);
        if (response.success) {
          this.addressesSubject.next(response.data.addresses || []);
          console.log(' [AddressService.addAddress] Success!');
          return true;
        }
        console.warn(' [AddressService.addAddress] Response not successful:', response);
        return false;
      }),
      catchError((error) => {
        console.error(' [AddressService.addAddress] Error:', error);
        return of(false);
      })
    );
  }

  // Update existing address
  updateAddress(addressId: string, address: AddressInfo, customerID?: string): Observable<boolean> {
    const cid = customerID || this.currentCustomerID;
    if (!cid) {
      console.error('No CustomerID available');
      return of(false);
    }

    return this.http.put<any>(`${this.apiUrl}/${cid}/update/${addressId}`, address).pipe(
      map((response) => {
        if (response.success) {
          this.addressesSubject.next(response.data.addresses || []);
          return true;
        }
        return false;
      }),
      catchError((error) => {
        console.error('Error updating address:', error);
        return of(false);
      })
    );
  }

  // Delete address
  deleteAddress(addressId: string, customerID?: string): Observable<boolean> {
    const cid = customerID || this.currentCustomerID;
    if (!cid) {
      console.error('No CustomerID available');
      return of(false);
    }

    return this.http.delete<any>(`${this.apiUrl}/${cid}/delete/${addressId}`).pipe(
      map((response) => {
        if (response.success) {
          this.addressesSubject.next(response.data.addresses || []);
          return true;
        }
        return false;
      }),
      catchError((error) => {
        console.error('Error deleting address:', error);
        return of(false);
      })
    );
  }

  // Set default address
  setDefaultAddress(addressId: string, customerID?: string): Observable<boolean> {
    const cid = customerID || this.currentCustomerID;
    if (!cid) {
      console.error('No CustomerID available');
      return of(false);
    }

    return this.http.put<any>(`${this.apiUrl}/${cid}/set-default/${addressId}`, {}).pipe(
      map((response) => {
        if (response.success) {
          this.addressesSubject.next(response.data.addresses || []);
          return true;
        }
        return false;
      }),
      catchError((error) => {
        console.error('Error setting default address:', error);
        return of(false);
      })
    );
  }

  // Get default address
  getDefaultAddress(customerID?: string): Observable<AddressInfo | null> {
    const cid = customerID || this.currentCustomerID;
    if (!cid) {
      return of(null);
    }

    return this.http.get<any>(`${this.apiUrl}/${cid}/default`).pipe(
      map((response) => {
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      }),
      catchError((error) => {
        console.error('Error getting default address:', error);
        return of(null);
      })
    );
  }

  // Get default address from current list (synchronous)
  getCurrentDefaultAddress(): AddressInfo | null {
    const addresses = this.getAddresses();
    return addresses.find((addr) => addr.isDefault) || (addresses.length > 0 ? addresses[0] : null);
  }

  /**
   * Load address tree data from MongoDB collection tree_complete
   */
  private loadAddressTree(): void {
    this.http.get<any>('http://localhost:3000/api/tree_complete').subscribe({
      next: (treeData: any) => {
        // tree_complete từ MongoDB là array chứa một object với structure: [{ tree: {...} }]
        // Hoặc có thể là array trực tiếp: [{...}]
        // Lấy phần tử đầu tiên của array
        const firstItem = Array.isArray(treeData) && treeData.length > 0 ? treeData[0] : treeData;

        // Nếu có field 'tree', lấy dữ liệu từ đó (khi import từ JSON vào MongoDB)
        // Nếu không, dùng trực tiếp firstItem (khi dữ liệu được lưu trực tiếp)
        const provincesObject = firstItem?.tree || firstItem;

        this.addressTree = provincesObject;
        this.addressTreeLoaded = true;
        console.log(
          '✅ [AddressService] Loaded address tree data from MongoDB for Vietnamese name formatting'
        );

        // Reload addresses to update names with proper Vietnamese formatting
        if (this.currentCustomerID) {
          this.loadAddressesFromServer(this.currentCustomerID);
        }
      },
      error: (error) => {
        console.error('❌ [AddressService] Error loading address tree from MongoDB:', error);
        // Fallback: try to load from JSON file if MongoDB fails
        this.http.get<any>('data/address/tree_complete.json').subscribe({
          next: (jsonData: any) => {
            // Xử lý tương tự như khi load từ API
            const firstItem =
              Array.isArray(jsonData) && jsonData.length > 0 ? jsonData[0] : jsonData;
            const provincesObject = firstItem?.tree || firstItem;

            this.addressTree = provincesObject;
            this.addressTreeLoaded = true;
            console.log('✅ [AddressService] Fallback: Loaded address tree from JSON file');

            // Reload addresses to update names with proper Vietnamese formatting
            if (this.currentCustomerID) {
              this.loadAddressesFromServer(this.currentCustomerID);
            }
          },
          error: (jsonError) => {
            console.error(
              '❌ [AddressService] Error loading address tree from JSON file:',
              jsonError
            );
          },
        });
      },
    });
  }

  /**
   * Find province by code or slug and return Vietnamese name with proper formatting
   */
  private findProvinceName(codeOrSlug: string): string {
    if (!this.addressTree || !codeOrSlug) return codeOrSlug;

    const normalizedSearch = codeOrSlug.toLowerCase().trim();

    // addressTree từ MongoDB là object với province codes làm keys
    // Try to find by code first
    if (this.addressTree[codeOrSlug]) {
      const province = this.addressTree[codeOrSlug];
      return province.name_with_type || province.name || codeOrSlug;
    }

    // Try to find by slug or code in all provinces (case-insensitive)
    for (const province of Object.values(this.addressTree) as any[]) {
      if (province) {
        const provinceSlug = (province.slug || '').toLowerCase().trim();
        const provinceCode = (province.code || '').toString().toLowerCase().trim();

        if (
          provinceSlug === normalizedSearch ||
          provinceCode === normalizedSearch ||
          provinceSlug === codeOrSlug.toLowerCase() ||
          provinceCode === codeOrSlug.toLowerCase()
        ) {
          return province.name_with_type || province.name || codeOrSlug;
        }
      }
    }

    // If not found, try to format from slug (e.g., "soc-trang" -> "Sóc Trăng")
    return this.formatVietnameseName(codeOrSlug);
  }

  /**
   * Find district by code or slug within a province
   */
  private findDistrictName(provinceCodeOrSlug: string, districtCodeOrSlug: string): string {
    if (!this.addressTree || !provinceCodeOrSlug || !districtCodeOrSlug) return districtCodeOrSlug;

    const normalizedDistrictSearch = districtCodeOrSlug.toLowerCase().trim();
    const normalizedProvinceSearch = provinceCodeOrSlug.toLowerCase().trim();

    // Find province first
    let province: any = null;
    if (this.addressTree[provinceCodeOrSlug]) {
      province = this.addressTree[provinceCodeOrSlug];
    } else {
      for (const p of Object.values(this.addressTree) as any[]) {
        if (p) {
          const pSlug = (p.slug || '').toLowerCase().trim();
          const pCode = (p.code || '').toString().toLowerCase().trim();
          if (
            pSlug === normalizedProvinceSearch ||
            pCode === normalizedProvinceSearch ||
            p.slug === provinceCodeOrSlug ||
            p.code === provinceCodeOrSlug
          ) {
            province = p;
            break;
          }
        }
      }
    }

    if (!province || !province['quan-huyen']) return this.formatVietnameseName(districtCodeOrSlug);

    // Try to find district by code
    if (province['quan-huyen'][districtCodeOrSlug]) {
      return (
        province['quan-huyen'][districtCodeOrSlug].name_with_type ||
        province['quan-huyen'][districtCodeOrSlug].name ||
        districtCodeOrSlug
      );
    }

    // Try to find by slug (case-insensitive)
    for (const district of Object.values(province['quan-huyen']) as any[]) {
      if (district) {
        const districtSlug = (district.slug || '').toLowerCase().trim();
        const districtCode = (district.code || '').toString().toLowerCase().trim();

        if (
          districtSlug === normalizedDistrictSearch ||
          districtCode === normalizedDistrictSearch ||
          district.slug === districtCodeOrSlug ||
          district.code === districtCodeOrSlug
        ) {
          return district.name_with_type || district.name || districtCodeOrSlug;
        }
      }
    }

    return this.formatVietnameseName(districtCodeOrSlug);
  }

  /**
   * Find ward by code or slug within a district
   */
  private findWardName(
    provinceCodeOrSlug: string,
    districtCodeOrSlug: string,
    wardCodeOrSlug: string
  ): string {
    if (!this.addressTree || !provinceCodeOrSlug || !districtCodeOrSlug || !wardCodeOrSlug)
      return wardCodeOrSlug;

    const normalizedWardSearch = wardCodeOrSlug.toLowerCase().trim();
    const normalizedDistrictSearch = districtCodeOrSlug.toLowerCase().trim();
    const normalizedProvinceSearch = provinceCodeOrSlug.toLowerCase().trim();

    // Find province first
    let province: any = null;
    if (this.addressTree[provinceCodeOrSlug]) {
      province = this.addressTree[provinceCodeOrSlug];
    } else {
      for (const p of Object.values(this.addressTree) as any[]) {
        if (p) {
          const pSlug = (p.slug || '').toLowerCase().trim();
          const pCode = (p.code || '').toString().toLowerCase().trim();
          if (
            pSlug === normalizedProvinceSearch ||
            pCode === normalizedProvinceSearch ||
            p.slug === provinceCodeOrSlug ||
            p.code === provinceCodeOrSlug
          ) {
            province = p;
            break;
          }
        }
      }
    }

    if (!province || !province['quan-huyen']) return this.formatVietnameseName(wardCodeOrSlug);

    // Find district
    let district: any = null;
    if (province['quan-huyen'][districtCodeOrSlug]) {
      district = province['quan-huyen'][districtCodeOrSlug];
    } else {
      for (const d of Object.values(province['quan-huyen']) as any[]) {
        if (d) {
          const dSlug = (d.slug || '').toLowerCase().trim();
          const dCode = (d.code || '').toString().toLowerCase().trim();
          if (
            dSlug === normalizedDistrictSearch ||
            dCode === normalizedDistrictSearch ||
            d.slug === districtCodeOrSlug ||
            d.code === districtCodeOrSlug
          ) {
            district = d;
            break;
          }
        }
      }
    }

    if (!district || !district['xa-phuong']) return this.formatVietnameseName(wardCodeOrSlug);

    // Try to find ward by code
    if (district['xa-phuong'][wardCodeOrSlug]) {
      return (
        district['xa-phuong'][wardCodeOrSlug].name_with_type ||
        district['xa-phuong'][wardCodeOrSlug].name ||
        wardCodeOrSlug
      );
    }

    // Try to find by slug (case-insensitive)
    for (const ward of Object.values(district['xa-phuong']) as any[]) {
      if (ward) {
        const wardSlug = (ward.slug || '').toLowerCase().trim();
        const wardCode = (ward.code || '').toString().toLowerCase().trim();

        if (
          wardSlug === normalizedWardSearch ||
          wardCode === normalizedWardSearch ||
          ward.slug === wardCodeOrSlug ||
          ward.code === wardCodeOrSlug
        ) {
          return ward.name_with_type || ward.name || wardCodeOrSlug;
        }
      }
    }

    return this.formatVietnameseName(wardCodeOrSlug);
  }

  /**
   * Format Vietnamese name from slug (e.g., "soc-trang" -> "Sóc Trăng")
   * This is a fallback when exact match is not found
   */
  private formatVietnameseName(slug: string): string {
    if (!slug) return '';

    // If already looks like Vietnamese (has Vietnamese characters), return as is but capitalize
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(slug)) {
      return this.capitalizeVietnamese(slug);
    }

    // Common Vietnamese location name mappings
    const nameMap: { [key: string]: string } = {
      // Provinces
      'soc-trang': 'Sóc Trăng',
      'can-tho': 'Cần Thơ',
      'quang-tri': 'Quảng Trị',
      // Districts
      'dong-ha': 'Đông Hà',
      'dong-le': 'Đông Lễ',
      // Wards
      'phuong-1': 'Phường 1',
      'phuong-2': 'Phường 2',
      'phuong-3': 'Phường 3',
      // Districts (HCM, HN)
      'quan-1': 'Quận 1',
      'quan-2': 'Quận 2',
      'quan-3': 'Quận 3',
    };

    const normalizedSlug = slug.toLowerCase().trim();
    if (nameMap[normalizedSlug]) {
      return nameMap[normalizedSlug];
    }

    // Try common Vietnamese word mappings
    const wordMap: { [key: string]: string } = {
      dong: 'Đông',
      ha: 'Hà',
      le: 'Lễ',
      quang: 'Quảng',
      tri: 'Trị',
      phuong: 'Phường',
      quan: 'Quận',
      huyen: 'Huyện',
      xa: 'Xã',
    };

    // Try to convert words in slug to Vietnamese
    const words = normalizedSlug.split(/[-_\s]+/);
    const convertedWords = words.map((word) => {
      // Check if word exists in wordMap
      if (wordMap[word]) {
        return wordMap[word];
      }
      // If word has Vietnamese characters, return as is
      if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(word)) {
        return word;
      }
      // Otherwise, capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

    // If we converted any words, return the result
    if (convertedWords.some((w, i) => w !== words[i])) {
      return convertedWords.join(' ');
    }

    // If not in map, try to capitalize words
    return this.capitalizeVietnamese(slug);
  }

  /**
   * Capitalize Vietnamese text properly
   */
  private capitalizeVietnamese(text: string): string {
    if (!text) return '';

    // Split by common separators and capitalize each word
    return text
      .split(/[-_\s]+/)
      .map((word) => {
        if (!word) return '';
        // Capitalize first letter, keep rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // Helper methods for city/district/ward mapping
  getCityNameFromId(cityId: string): string {
    // Try to get from address tree first
    if (this.addressTree) {
      const name = this.findProvinceName(cityId);
      if (name && name !== cityId) {
        return name;
      }
    }

    // Fallback to hardcoded mapping
    const cities: any = {
      hcm: 'Thành phố Hồ Chí Minh',
      hn: 'Hà Nội',
      dn: 'Đà Nẵng',
    };
    return cities[cityId] || this.formatVietnameseName(cityId);
  }

  getDistrictNameFromId(districtId: string, provinceId?: string): string {
    // Try to get from address tree if provinceId is provided
    if (this.addressTree && provinceId) {
      const name = this.findDistrictName(provinceId, districtId);
      if (name && name !== districtId) {
        return name;
      }
    }

    // Fallback to hardcoded mapping
    const districts: any = {
      q1: 'Quận 1',
      q2: 'Quận 2',
      q3: 'Quận 3',
      hk: 'Quận Hoàn Kiếm',
      bd: 'Quận Ba Đình',
      tx: 'Quận Thanh Xuân',
      hd: 'Quận Hải Châu',
      tl: 'Quận Thanh Khê',
      sn: 'Quận Sơn Trà',
    };
    return districts[districtId] || this.formatVietnameseName(districtId);
  }

  getWardNameFromId(wardId: string, provinceId?: string, districtId?: string): string {
    // Try to get from address tree if provinceId and districtId are provided
    if (this.addressTree && provinceId && districtId) {
      const name = this.findWardName(provinceId, districtId, wardId);
      if (name && name !== wardId) {
        return name;
      }
    }

    // Fallback to hardcoded mapping
    const wards: any = {
      p1: 'Phường Bến Nghé',
      p2: 'Phường Bến Thành',
      p3: 'Phường Cầu Ông Lãnh',
      p4: 'Phường An Phú',
      p5: 'Phường Thảo Điền',
      p6: 'Phường Bình An',
      p7: 'Phường 1',
      p8: 'Phường 2',
      p9: 'Phường 3',
      p10: 'Phường Hàng Bạc',
      p11: 'Phường Tràng Tiền',
      p12: 'Phường Phan Chu Trinh',
    };
    return wards[wardId] || this.formatVietnameseName(wardId);
  }

  getCityIdFromName(cityName: string): string {
    const cityMap: any = {
      'Thành phố Hồ Chí Minh': 'hcm',
      'Hà Nội': 'hn',
      'Đà Nẵng': 'dn',
    };
    return cityMap[cityName] || '';
  }

  getDistrictIdFromName(districtName: string): string {
    const districtMap: any = {
      'Quận 1': 'q1',
      'Quận 2': 'q2',
      'Quận 3': 'q3',
      'Quận Hoàn Kiếm': 'hk',
      'Quận Ba Đình': 'bd',
      'Quận Thanh Xuân': 'tx',
      'Quận Hải Châu': 'hd',
      'Quận Thanh Khê': 'tl',
      'Quận Sơn Trà': 'sn',
    };
    return districtMap[districtName] || '';
  }

  getWardIdFromName(wardName: string): string {
    const wardMap: any = {
      'Phường Bến Nghé': 'p1',
      'Phường Bến Thành': 'p2',
      'Phường Cầu Ông Lãnh': 'p3',
      'Phường An Phú': 'p4',
      'Phường Thảo Điền': 'p5',
      'Phường Bình An': 'p6',
      'Phường 1': 'p7',
      'Phường 2': 'p8',
      'Phường 3': 'p9',
      'Phường Hàng Bạc': 'p10',
      'Phường Tràng Tiền': 'p11',
      'Phường Phan Chu Trinh': 'p12',
    };
    return wardMap[wardName] || '';
  }
}
