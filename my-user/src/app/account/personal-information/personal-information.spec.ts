import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonalInformation } from './personal-information';

describe('PersonalInformation', () => {
  let component: PersonalInformation;
  let fixture: ComponentFixture<PersonalInformation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInformation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersonalInformation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
