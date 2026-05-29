import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InformationList } from './information-list';

describe('InformationList', () => {
  let component: InformationList;
  let fixture: ComponentFixture<InformationList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InformationList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InformationList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
