import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdersManage } from './ordersmanage';

describe('OrdersManage', () => {
  let component: OrdersManage;
  let fixture: ComponentFixture<OrdersManage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersManage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdersManage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

