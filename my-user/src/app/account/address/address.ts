import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AddressFormComponent, AddressInfo } from '../../order/address-form/address-form';
import { AddressService, AddressInfo as ServiceAddressInfo } from '../../services/address.service';
import { ToastService } from '../../services/toast.service';

interface Address {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  isDefault: boolean;
}

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [CommonModule, FormsModule, AddressFormComponent],
  templateUrl: './address.html',
  styleUrls: ['./address.css'],
})
export class AddressComponent implements OnInit, OnDestroy {
  addresses: Address[] = [];
  isEditing: boolean = false;
  editingAddressId: string | null = null;
  showAddressFormModal: boolean = false;
  showDeleteConfirm: boolean = false;
  addressToDelete: Address | null = null;

  // Address info for AddressFormComponent
  addressInfoForForm: AddressInfo = {
    fullName: '',
    phone: '',
    email: '',
    city: '',
    district: '',
    ward: '',
    detail: '',
    deliveryMethod: 'standard',
  };

  private addressSubscription: Subscription = new Subscription();

  constructor(private addressService: AddressService, private toastService: ToastService) {}

  ngOnInit(): void {
    console.log('� [AddressComponent.ngOnInit] START');

    // Debug localStorage
    console.log(' Debug localStorage:');
    console.log(' - localStorage["user"]:', localStorage.getItem('user'));
    console.log(' - All localStorage keys:', Object.keys(localStorage));

    // Force reload CustomerID từ localStorage trước
    console.log(' Calling addressService.reloadCustomerID()...');
    this.addressService.reloadCustomerID();

    console.log(' Loading addresses...');
    this.loadAddresses();
  }

  ngOnDestroy(): void {
    if (this.addressSubscription) {
      this.addressSubscription.unsubscribe();
    }
  }

  loadAddresses(): void {
    // Subscribe to address changes from AddressService
    this.addressSubscription = this.addressService.addresses$.subscribe((addresses) => {
      // Convert ServiceAddressInfo to Address format for display
      const mappedAddresses = addresses.map((addr) => ({
        id: addr._id || '',
        name: addr.fullName,
        address: addr.detail,
        phone: addr.phone,
        email: addr.email,
        province: this.addressService.getCityNameFromId(addr.city),
        district: this.addressService.getDistrictNameFromId(addr.district, addr.city),
        ward: this.addressService.getWardNameFromId(addr.ward, addr.city, addr.district),
        // Lưu ID/slug gốc để dùng khi edit
        cityId: addr.city,
        districtId: addr.district,
        wardId: addr.ward,
        isDefault: addr.isDefault || false,
      }));

      // Sắp xếp: địa chỉ mặc định lên đầu tiên
      this.addresses = mappedAddresses.sort((a, b) => {
        // Nếu a là default và b không phải default -> a lên trước (return -1)
        if (a.isDefault && !b.isDefault) return -1;
        // Nếu b là default và a không phải default -> b lên trước (return 1)
        if (b.isDefault && !a.isDefault) return 1;
        // Nếu cả hai cùng default hoặc cùng không default -> giữ nguyên thứ tự (return 0)
        return 0;
      });
    });
  }

  onEditAddress(address: Address): void {
    this.editingAddressId = address.id;
    // Map Address to AddressInfo
    // Sử dụng ID/slug gốc nếu có, nếu không thì thử convert từ tên
    this.addressInfoForForm = {
      fullName: address.name,
      phone: address.phone,
      email: address.email,
      city:
        (address as any).cityId || this.addressService.getCityIdFromName(address.province) || '',
      district:
        (address as any).districtId ||
        this.addressService.getDistrictIdFromName(address.district) ||
        '',
      ward: (address as any).wardId || this.addressService.getWardIdFromName(address.ward) || '',
      detail: address.address,
      deliveryMethod: 'standard',
    };
    this.isEditing = true;
    this.showAddressFormModal = true;
  }

  onAddNewAddress(): void {
    this.isEditing = false;
    this.editingAddressId = null;
    // Reset form
    this.addressInfoForForm = {
      fullName: '',
      phone: '',
      email: '',
      city: '',
      district: '',
      ward: '',
      detail: '',
      deliveryMethod: 'standard',
    };
    this.showAddressFormModal = true;
  }

  onAddressComplete(addressInfo: AddressInfo): void {
    console.log(' [AddressComponent.onAddressComplete] START');
    console.log(' - Received addressInfo:', addressInfo);
    console.log(' - isEditing:', this.isEditing);
    console.log(' - editingAddressId:', this.editingAddressId);
    console.log(' - isDefault:', addressInfo.isDefault);

    // Convert form AddressInfo to ServiceAddressInfo
    const serviceAddress: ServiceAddressInfo = {
      fullName: addressInfo.fullName,
      phone: addressInfo.phone,
      email: addressInfo.email,
      city: addressInfo.city,
      district: addressInfo.district,
      ward: addressInfo.ward,
      detail: addressInfo.detail,
      notes: addressInfo.notes,
      deliveryMethod: addressInfo.deliveryMethod,
      isDefault: addressInfo.isDefault, // Thêm isDefault vào serviceAddress
    };

    console.log(' - Converted to serviceAddress:', serviceAddress);

    if (this.isEditing && this.editingAddressId) {
      console.log(' Mode: UPDATE');
      // Update existing address via service - PHẢI SUBSCRIBE
      this.addressService.updateAddress(this.editingAddressId, serviceAddress).subscribe({
        next: (success) => {
          if (success) {
            console.log(' [Address] Đã cập nhật địa chỉ thành công');
            // Nếu được đánh dấu là mặc định, gọi setDefaultAddress
            if (addressInfo.isDefault && this.editingAddressId) {
              this.addressService.setDefaultAddress(this.editingAddressId).subscribe({
                next: (defaultSuccess) => {
                  if (defaultSuccess) {
                    console.log(' [Address] Đã đặt địa chỉ làm mặc định');
                  } else {
                    console.error(' [Address] Đặt địa chỉ mặc định thất bại');
                  }
                },
                error: (error) => {
                  console.error(' [Address] Lỗi khi đặt địa chỉ mặc định:', error);
                },
              });
            }
          } else {
            console.error(' [Address] Cập nhật địa chỉ thất bại');
          }
        },
        error: (error) => {
          console.error(' [Address] Lỗi khi cập nhật địa chỉ:', error);
        },
      });
    } else {
      console.log(' Mode: ADD NEW');
      // Add new address via service - PHẢI SUBSCRIBE
      console.log(' Calling addressService.addAddress()...');
      console.log(' - serviceAddress.isDefault:', serviceAddress.isDefault);

      this.addressService.addAddress(serviceAddress).subscribe({
        next: (success) => {
          if (success) {
            console.log(' [Address] Đã thêm địa chỉ mới thành công');

            // Backend tự động xử lý isDefault khi thêm địa chỉ
            // (xem backend/routes/address.js line 73-81)
            if (addressInfo.isDefault) {
              this.toastService.show('Đã thêm địa chỉ và đặt làm mặc định thành công!', 'success');
            } else {
              this.toastService.show('Đã thêm địa chỉ thành công!', 'success');
            }
          } else {
            console.error(' [Address] Thêm địa chỉ thất bại');
            this.toastService.show('Thêm địa chỉ thất bại. Vui lòng thử lại!', 'error');
          }
        },
        error: (error) => {
          console.error(' [Address] Lỗi khi thêm địa chỉ:', error);
          this.toastService.show('Có lỗi xảy ra khi thêm địa chỉ. Vui lòng thử lại!', 'error');
        },
      });
    }

    this.closeAddressFormModal();
  }

  closeAddressFormModal(): void {
    this.showAddressFormModal = false;
    this.isEditing = false;
    this.editingAddressId = null;
  }

  onDeleteAddress(address: Address): void {
    this.addressToDelete = address;
    this.showDeleteConfirm = true;
  }

  onConfirmDelete(): void {
    if (this.addressToDelete && this.addressToDelete.id) {
      // Delete via service - PHẢI SUBSCRIBE
      this.addressService.deleteAddress(this.addressToDelete.id).subscribe({
        next: (success) => {
          if (success) {
            console.log(' [Address] Đã xóa địa chỉ thành công');
            this.resetForm();
            this.showDeleteConfirm = false;
            this.addressToDelete = null;
            // Hiển thị toast màu xanh thông báo đã xóa thành công
            this.toastService.show('Đã xóa địa chỉ thành công!', 'success');
          } else {
            console.error(' [Address] Xóa địa chỉ thất bại');
            // Hiển thị toast màu đỏ nếu xóa thất bại
            this.toastService.show('Xóa địa chỉ thất bại. Vui lòng thử lại!', 'error');
          }
        },
        error: (error) => {
          console.error(' [Address] Lỗi khi xóa địa chỉ:', error);
          // Hiển thị toast màu đỏ nếu có lỗi
          this.toastService.show('Có lỗi xảy ra khi xóa địa chỉ. Vui lòng thử lại!', 'error');
        },
      });
    }
  }

  onCancelDelete(): void {
    this.showDeleteConfirm = false;
    this.addressToDelete = null;
  }

  resetForm(): void {
    this.isEditing = false;
    this.showAddressFormModal = false;
    this.showDeleteConfirm = false;
    this.editingAddressId = null;
    this.addressToDelete = null;
    this.addressInfoForForm = {
      fullName: '',
      phone: '',
      email: '',
      city: '',
      district: '',
      ward: '',
      detail: '',
      deliveryMethod: 'standard',
    };
  }

  onSetDefaultAddress(address: Address): void {
    if (address.id) {
      // Set default via service - PHẢI SUBSCRIBE
      this.addressService.setDefaultAddress(address.id).subscribe({
        next: (success) => {
          if (success) {
            console.log(' [Address] Đã đặt địa chỉ mặc định thành công');
          } else {
            console.error(' [Address] Đặt địa chỉ mặc định thất bại');
          }
        },
        error: (error) => {
          console.error(' [Address] Lỗi khi đặt địa chỉ mặc định:', error);
        },
      });
    }
  }

  // Helper methods to format full address
  getFullAddress(address: Address): string {
    const parts = [];

    if (address.address) parts.push(address.address);
    if (address.ward) parts.push(address.ward);
    if (address.district) parts.push(address.district);
    if (address.province) parts.push(address.province);

    return parts.join(', ');
  }
}
