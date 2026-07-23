import { Component, ViewChild } from '@angular/core'
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { FormsModule } from '@angular/forms'
import { RecaptchaComponent } from './recaptcha.component'
import type { Grecaptcha } from './recaptcha.types'

interface MockGrecaptcha extends Grecaptcha {
  lastParams?: Record<string, unknown>
}

function installGrecaptchaMock(): MockGrecaptcha {
  const responses = new Map<number, string>()
  let nextId = 0
  const mock: MockGrecaptcha = {
    render(_el: HTMLElement, params: Record<string, unknown>) {
      const id = nextId++
      mock.lastParams = params
      responses.set(id, '')
      return id
    },
    reset: jasmine.createSpy('reset').and.callFake((id: number) => responses.set(id, '')),
    execute: jasmine.createSpy('execute'),
    getResponse: (id: number) => responses.get(id) ?? '',
  }
  ;(window as any).grecaptcha = mock
  return mock
}

@Component({
  standalone: true,
  imports: [RecaptchaComponent, FormsModule],
  template: `
    <recaptcha-v2
      #captcha
      sitekey="test-key"
      theme="dark"
      size="compact"
      [(ngModel)]="token"
      (verify)="onVerify($event)"
      (expire)="onExpire()"
    ></recaptcha-v2>
  `,
})
class HostComponent {
  @ViewChild('captcha') captcha!: RecaptchaComponent
  token = ''
  verified: string | null = null
  expired = false
  onVerify(t: string) {
    this.verified = t
  }
  onExpire() {
    this.expired = true
  }
}

describe('RecaptchaComponent', () => {
  let fixture: ComponentFixture<HostComponent>
  let host: HostComponent

  beforeEach(async () => {
    document.getElementById('google-recaptcha-script')?.remove()
    delete (window as any).grecaptcha

    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents()

    fixture = TestBed.createComponent(HostComponent)
    host = fixture.componentInstance
  })

  it('renders the widget with the given params', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges() // triggers ngAfterViewInit
    expect(mock.lastParams).toBeDefined()
    expect(mock.lastParams!['sitekey']).toBe('test-key')
    expect(mock.lastParams!['theme']).toBe('dark')
    expect(mock.lastParams!['size']).toBe('compact')
  })

  it('emits verify and updates the bound model when solved', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()
    const cb = mock.lastParams!['callback'] as string
    ;(window as any)[cb]('the-token')
    fixture.detectChanges()

    expect(host.verified).toBe('the-token')
    expect(host.token).toBe('the-token')
  })

  it('emits expire and clears the model when the token expires', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()
    const cb = mock.lastParams!['expired-callback'] as string
    ;(window as any)[cb]()
    fixture.detectChanges()

    expect(host.expired).toBe(true)
    expect(host.token).toBe('')
  })

  it('exposes reset / execute / getResponse', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()

    host.captcha.reset()
    host.captcha.execute()
    expect(mock.reset).toHaveBeenCalled()
    expect(mock.execute).toHaveBeenCalled()
    expect(host.captcha.getResponse()).toBe('')
  })

  it('injects the reCAPTCHA script only once across instances', () => {
    fixture.detectChanges()
    const another = TestBed.createComponent(HostComponent)
    another.detectChanges()
    expect(document.querySelectorAll('#google-recaptcha-script').length).toBe(1)
  })
})
