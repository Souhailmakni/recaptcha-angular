import { Component, ViewChild } from '@angular/core'
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
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
      responses.set(id, 'token-' + id)
      return id
    },
    reset: jasmine.createSpy('reset').and.callFake((id: number) => responses.set(id, '')),
    execute: jasmine.createSpy('execute'),
    getResponse: (id: number) => responses.get(id) ?? '',
  }
  ;(window as any).grecaptcha = mock
  return mock
}

function findOnLoadCallback(): (() => void) | undefined {
  const key = Object.keys(window).find((k) => k.startsWith('__recaptchaOnLoad_'))
  return key ? (window as any)[key] : undefined
}

@Component({
  standalone: true,
  imports: [RecaptchaComponent, FormsModule],
  template: `
    <recaptcha-v2
      #captcha
      [sitekey]="sitekey"
      [language]="language"
      theme="dark"
      size="compact"
      [(ngModel)]="token"
      (verify)="onVerify($event)"
      (expire)="onExpire()"
      (error)="onError()"
      (widgetId)="onWidgetId($event)"
    ></recaptcha-v2>
  `,
})
class HostComponent {
  @ViewChild('captcha') captcha!: RecaptchaComponent
  sitekey = 'test-key'
  language = ''
  token = ''
  verified: string | null = null
  expired = false
  errored = false
  widget: number | null = null
  onVerify(t: string) {
    this.verified = t
  }
  onExpire() {
    this.expired = true
  }
  onError() {
    this.errored = true
  }
  onWidgetId(id: number) {
    this.widget = id
  }
}

describe('RecaptchaComponent', () => {
  let fixture: ComponentFixture<HostComponent>
  let host: HostComponent

  beforeEach(async () => {
    document.getElementById('google-recaptcha-script')?.remove()
    delete (window as any).grecaptcha
    Object.keys(window)
      .filter((k) => k.startsWith('__recaptcha'))
      .forEach((k) => delete (window as any)[k])

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
    expect(host.widget).toEqual(jasmine.any(Number))
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

  it('emits error and clears the model on the error callback', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()
    const cb = mock.lastParams!['error-callback'] as string
    host.token = 'stale'
    ;(window as any)[cb]()
    fixture.detectChanges()

    expect(host.errored).toBe(true)
    expect(host.token).toBe('')
  })

  it('exposes reset / execute / getResponse', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()

    expect(host.captcha.getResponse()).toBe('token-0')
    host.captcha.reset()
    host.captcha.execute()
    expect(mock.reset).toHaveBeenCalled()
    expect(mock.execute).toHaveBeenCalled()
    expect(host.captcha.getResponse()).toBe('')
  })

  it('imperative methods are no-ops before the widget renders', () => {
    // No grecaptcha installed, so nothing renders.
    fixture.detectChanges()
    expect(host.captcha.getResponse()).toBe('')
    expect(() => {
      host.captcha.reset()
      host.captcha.execute()
    }).not.toThrow()
  })

  it('adds the hl param when a language is given', () => {
    host.language = 'fr'
    fixture.detectChanges()
    const script = document.getElementById('google-recaptcha-script') as HTMLScriptElement
    expect(script.src).toContain('&hl=fr')
  })

  it('renders via the global onload callback after the script loads', () => {
    fixture.detectChanges() // injects script, registers onload
    const onload = findOnLoadCallback()
    expect(onload).toEqual(jasmine.any(Function))

    const mock = installGrecaptchaMock()
    onload!()
    expect(mock.lastParams).toBeDefined()
  })

  it('polls for grecaptcha when the script tag already exists', fakeAsync(() => {
    const existing = document.createElement('script')
    existing.id = 'google-recaptcha-script'
    document.head.appendChild(existing)

    fixture.detectChanges() // no grecaptcha yet -> starts polling
    const mock = installGrecaptchaMock()
    tick(100)

    expect(mock.lastParams).toBeDefined()
  }))

  it('emits error when the script fails to load', () => {
    fixture.detectChanges()
    const script = document.getElementById('google-recaptcha-script') as HTMLScriptElement
    script.onerror?.(new Event('error'))
    expect(host.errored).toBe(true)
  })

  it('emits error if the widget never loads before the timeout', fakeAsync(() => {
    host.captcha // ensure created
    fixture.detectChanges()
    // Default loadingTimeout is 30000; no grecaptcha ever appears.
    tick(30000)
    expect(host.errored).toBe(true)
  }))

  it('re-renders the widget when the sitekey changes', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()
    expect(mock.lastParams!['sitekey']).toBe('test-key')

    host.sitekey = 'new-key'
    fixture.detectChanges()
    expect(mock.lastParams!['sitekey']).toBe('new-key')
  })

  it('resets the widget when writeValue clears it, ignores non-empty writes', () => {
    const mock = installGrecaptchaMock()
    fixture.detectChanges()

    // Clearing the value resets the widget.
    ;(mock.reset as jasmine.Spy).calls.reset()
    host.captcha.writeValue('')
    expect(mock.reset).toHaveBeenCalled()

    // A non-empty value is owned by grecaptcha and cannot be written back.
    ;(mock.reset as jasmine.Spy).calls.reset()
    host.captcha.writeValue('something')
    expect(mock.reset).not.toHaveBeenCalled()
  })

  it('injects the reCAPTCHA script only once across instances', () => {
    fixture.detectChanges()
    const another = TestBed.createComponent(HostComponent)
    another.detectChanges()
    expect(document.querySelectorAll('#google-recaptcha-script').length).toBe(1)
  })
})
