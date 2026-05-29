import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CookbookDetail } from './cookbook-detail';

describe('CookbookDetail', () => {
  let component: CookbookDetail;
  let fixture: ComponentFixture<CookbookDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookbookDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CookbookDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
