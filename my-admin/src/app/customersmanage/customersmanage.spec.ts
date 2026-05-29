import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomersManage } from './customersmanage';

describe('CustomersManage', () => {
  let component: CustomersManage;
  let fixture: ComponentFixture<CustomersManage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomersManage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomersManage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

