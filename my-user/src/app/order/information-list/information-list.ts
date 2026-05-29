import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollLockService } from '../../services/scroll-lock.service';
import { ToastService } from '../../services/toast.service';
import { AddressService } from '../../services/address.service';

export interface AddressInfo {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  ward: string;
  detail: string;
  deliveryMethod: string;
  isDefault?: boolean;
}

@Component({
  selector: 'app-information-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './information-list.html',
  styleUrl: './information-list.css',
})
export class InformationList implements OnInit, OnDestroy {
  @Input() addressList: AddressInfo[] = [];
  @Input() selectedIndex: number = 0;
  @Input() defaultAddressIndices: boolean[] = []; // Mảng boolean đánh dấu địa chỉ mặc định

  @Output() closeModal = new EventEmitter<void>();
  @Output() selectAddress = new EventEmitter<number>();
  @Output() editAddress = new EventEmitter<number>();
  @Output() deleteAddress = new EventEmitter<number>();
  @Output() addNewAddress = new EventEmitter<void>();

  showDeleteConfirm: boolean = false;
  addressToDeleteIndex: number = -1;
  private addressService = inject(AddressService);

  constructor(private scrollLock: ScrollLockService, private toastService: ToastService) {}

  ngOnInit() {
    this.scrollLock.lock();
  }

  ngOnDestroy() {
    this.scrollLock.unlock();
  }

  onClose() {
    this.closeModal.emit();
  }

  onSelectAddress(index: number) {
    this.selectedIndex = index;
  }

  onConfirm() {
    if (this.selectedIndex >= 0) {
      this.selectAddress.emit(this.selectedIndex);
      this.onClose();
    }
  }

  onEditAddress(index: number) {
    this.editAddress.emit(index);
  }

  onDeleteAddress(index: number) {
    this.addressToDeleteIndex = index;
    this.showDeleteConfirm = true;
  }

  onConfirmDelete(): void {
    if (this.addressToDeleteIndex >= 0) {
      this.deleteAddress.emit(this.addressToDeleteIndex);
      this.showDeleteConfirm = false;
      this.addressToDeleteIndex = -1;
 // Hiển thị toast màu xanh thông báo đã xóa thành công với z-index cao 
      this.toastService.show('Đã xóa địa chỉ thành công!', 'success', 22000);
    }
  }

  onCancelDelete(): void {
    this.showDeleteConfirm = false;
    this.addressToDeleteIndex = -1;
  }

  onAddNewAddress() {
    this.addNewAddress.emit();
  }

  getAddressNameWithPhone(address: AddressInfo): string {
    return `${address.fullName} - ${address.phone}`;
  }

  isDefaultAddress(index: number): boolean {
    if (this.defaultAddressIndices && this.defaultAddressIndices.length > index) {
      return this.defaultAddressIndices[index];
    }
    return this.addressList[index]?.isDefault || false;
  }

  getAddressString(address: AddressInfo): string {
    // Sử dụng AddressService để format địa chỉ tiếng Việt có dấu và viết hoa
    const cityName = this.addressService.getCityNameFromId(address.city);
    const districtName = this.addressService.getDistrictNameFromId(address.district, address.city);
    const wardName = this.addressService.getWardNameFromId(address.ward, address.city, address.district);

    const addressParts = [address.detail, wardName, districtName, cityName].filter(
      (part) => part && part.trim() !== ''
    );

    return addressParts.join(', ');
  }
}
