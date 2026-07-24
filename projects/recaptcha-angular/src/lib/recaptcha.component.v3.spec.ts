import { Component, ViewChild } from '@angular/core'
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { RecaptchaComponent } from './recaptcha.component'

function mockV3(token = 'v3-token') {
  const execute = jasmine
    .createSpy('execute')
    .and.callFake((_key: string, opts: { action: string }) => {
      ;(window as any).__lastAction = opts.action
      return Promise.resolve(token)
    })
  ;(window as any).grecaptcha = {
    ready: (cb: () => void) => cb(),
    execute,
    render: jasmine.createSpy('render'),
    reset: jasmine.createSpy('reset'),
    getResponse: () => '',
  }
  return execute
}

function removeV3Scripts() {
  document
    .querySelectorAll('script[id^="google-recaptcha-v3-script"]')
    .forEach((s) => s.remove())
}

@Component({
  standalone: true,
  imports: [RecaptchaComponent],
  template: `
    <recaptcha-v2
      #captcha
      sitekey="key-123"
      version="v3"
      [action]="action"
      [hideBadge]="hideBadge"
      (verify)="onVerify($event)"
      (error)="onError()"
    ></recaptcha-v2>
  `,
})
class HostV3Component {
  @ViewChild('captcha') captcha!: RecaptchaComponent
  action = 'submit'
  hideBadge = false
  verified: string | null = null
  errored = false
  onVerify(t: string) {
    this.verified = t
  }
  onError() {
    this.errored = true
  }
}

describe('RecaptchaComponent (v3)', () => {
  let fixture: ComponentFixture<HostV3Component>
  let host: HostV3Component

  beforeEach(async () => {
    removeV3Scripts()
    delete (window as any).grecaptcha
    delete (window as any).__lastAction
    Object.keys(window)
      .filter((k) => k.startsWith('__recaptcha'))
      .forEach((k) => delete (window as any)[k])

    await TestBed.configureTestingModule({ imports: [HostV3Component] }).compileComponents()
    fixture = TestBed.createComponent(HostV3Component)
    host = fixture.componentInstance
  })

  it('loads the v3 script with render=SITE_KEY (not explicit)', () => {
    fixture.detectChanges()
    const script = document.querySelector(
      'script[id^="google-recaptcha-v3-script"]'
    ) as HTMLScriptElement
    expect(script).toBeTruthy()
    expect(script.src).toContain('render=key-123')
    expect(script.src).not.toContain('render=explicit')
  })

  it('does not render a visible widget', () => {
    const execute = mockV3()
    fixture.detectChanges()
    expect(execute).not.toHaveBeenCalled()
    expect((window as any).grecaptcha.render).not.toHaveBeenCalled()
  })

  it('execute(action) resolves the token and emits verify', async () => {
    const execute = mockV3('the-v3-token')
    fixture.detectChanges()

    const token = await host.captcha.execute('login')
    expect(token).toBe('the-v3-token')
    expect(execute).toHaveBeenCalledWith('key-123', { action: 'login' })
    expect(host.verified).toBe('the-v3-token')
    expect(host.captcha.getResponse()).toBe('the-v3-token')
  })

  it('falls back to the action input when execute() has no argument', async () => {
    const execute = mockV3()
    host.action = 'checkout'
    fixture.detectChanges()

    await host.captcha.execute()
    expect(execute).toHaveBeenCalledWith('key-123', { action: 'checkout' })
  })

  it('emits error and rejects when grecaptcha.execute fails', async () => {
    ;(window as any).grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute: jasmine.createSpy('execute').and.returnValue(Promise.reject(new Error('boom'))),
      render: jasmine.createSpy('render'),
      reset: jasmine.createSpy('reset'),
      getResponse: () => '',
    }
    fixture.detectChanges()

    await expectAsync(host.captcha.execute('x')).toBeRejectedWithError('boom')
    expect(host.errored).toBe(true)
  })

  it('reset clears the last token', async () => {
    mockV3('tok')
    fixture.detectChanges()

    await host.captcha.execute('a')
    expect(host.captcha.getResponse()).toBe('tok')
    host.captcha.reset()
    expect(host.captcha.getResponse()).toBe('')
  })

  it('injects a badge-hiding style when hideBadge is set', () => {
    mockV3()
    host.hideBadge = true
    fixture.detectChanges()
    const style = Array.from(document.querySelectorAll('style')).find((s) =>
      s.textContent?.includes('.grecaptcha-badge')
    )
    expect(style).toBeTruthy()
  })

  it('becomes ready via script onload when grecaptcha appears after view init', () => {
    fixture.detectChanges()
    const script = document.querySelector(
      'script[id^="google-recaptcha-v3-script"]'
    ) as HTMLScriptElement
    mockV3('tok')
    script.onload?.(new Event('load'))
    // no throw, readiness resolved internally
    expect((window as any).grecaptcha).toBeTruthy()
  })

  it('emits error when the v3 script fails to load', () => {
    fixture.detectChanges()
    const script = document.querySelector(
      'script[id^="google-recaptcha-v3-script"]'
    ) as HTMLScriptElement
    script.onerror?.(new Event('error'))
    expect(host.errored).toBe(true)
  })

  it('polls for grecaptcha when a v3 script already exists', fakeAsync(() => {
    const existing = document.createElement('script')
    existing.id = 'google-recaptcha-v3-script-key-123'
    document.head.appendChild(existing)

    fixture.detectChanges()
    const execute = mockV3('tok')
    tick(100) // poll fires, grecaptcha.ready resolves v3Ready

    // ready fired via the poll; execute now works
    host.captcha.execute('a')
    tick() // flush the `await v3Ready` continuation so grecaptcha.execute runs
    expect(execute).toHaveBeenCalled()
  }))
})
