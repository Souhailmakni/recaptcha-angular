import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import type {
  RecaptchaBadge,
  RecaptchaSize,
  RecaptchaTheme,
  RecaptchaVersion,
} from './recaptcha.types'

/**
 * Google reCAPTCHA component for Angular, supporting both v2 (visible checkbox)
 * and v3 (score-based). Defaults to v2.
 *
 * Loads the reCAPTCHA script once per page and is safe to use multiple times.
 * Implements `ControlValueAccessor`, so it works with `[(ngModel)]` and reactive
 * `formControlName` (the verified token is the control value). On v3 there is no
 * widget; call `execute(action)` to get a token.
 *
 * @example
 * ```html
 * <recaptcha-v2
 *   sitekey="YOUR_SITE_KEY"
 *   [(ngModel)]="token"
 *   (verify)="onVerify($event)"
 *   (expire)="onExpire()"
 *   (error)="onError()"
 * ></recaptcha-v2>
 * ```
 */
@Component({
  selector: 'recaptcha-v2',
  standalone: true,
  template: `<div #container class="ng-recaptcha" style="display:inline-block"></div>`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RecaptchaComponent),
      multi: true,
    },
  ],
})
export class RecaptchaComponent
  implements AfterViewInit, OnDestroy, OnChanges, ControlValueAccessor
{
  /** Your reCAPTCHA site key from https://www.google.com/recaptcha/admin */
  @Input({ required: true }) sitekey!: string

  /** Which reCAPTCHA to use. Default: 'v2' (the visible checkbox). */
  @Input() version: RecaptchaVersion = 'v2'

  /** v3 only. Default action when `execute()` is called with no argument. */
  @Input() action = 'submit'

  /** v2 only. Widget color scheme. Default: 'light' */
  @Input() theme: RecaptchaTheme = 'light'

  /** v2 only. Widget size. Default: 'normal' */
  @Input() size: RecaptchaSize = 'normal'

  /** v2 only. Tab index of the widget. Default: 0 */
  @Input() tabindex = 0

  /** Timeout in ms before emitting `error` if the script never loads. Default: 30000 */
  @Input() loadingTimeout = 30000

  /** Optional BCP 47 language code for the widget, e.g. 'fr', 'ar' */
  @Input() language = ''

  /** v2 only. Position of the reCAPTCHA badge (invisible size). Default: 'bottomright' */
  @Input() badge: RecaptchaBadge = 'bottomright'

  /**
   * v3 only. Hide the floating badge. If you hide it you must display the
   * "protected by reCAPTCHA" legal text yourself (Google's terms require it).
   */
  @Input() hideBadge = false

  /** v2 only. Whether to isolate this widget from others on the page */
  @Input() isolated = false

  /** Emitted with the token: on v2 when solved, on v3 whenever `execute()` resolves */
  @Output() verify = new EventEmitter<string>()

  /** v2 only. Emitted when the response token expires */
  @Output() expire = new EventEmitter<void>()

  /** Emitted when reCAPTCHA encounters an error (network, script load, execute failure) */
  @Output() error = new EventEmitter<void>()

  /** v2 only. Emitted with the widget ID once the widget is rendered */
  @Output() widgetId = new EventEmitter<number>()

  @ViewChild('container', { static: true })
  private containerRef!: ElementRef<HTMLDivElement>

  private currentWidgetId: number | null = null
  private isLoaded = false
  private lastToken = ''
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private pollHandle: ReturnType<typeof setInterval> | null = null
  private styleEl: HTMLStyleElement | null = null
  private viewReady = false
  // Resolves a pending v2 execute() when the next verify fires.
  private pendingExecute: ((token: string) => void) | null = null
  // Resolves once grecaptcha is ready in v3 mode.
  private resolveV3Ready: () => void = () => {}
  private v3Ready: Promise<void> = new Promise((resolve) => {
    this.resolveV3Ready = resolve
  })

  // Unique callback names so multiple instances don't collide.
  private readonly instanceId = Math.random().toString(36).slice(2)
  private readonly onLoadCallbackName = `__recaptchaOnLoad_${this.instanceId}`
  private readonly onVerifyCallbackName = `__recaptchaVerify_${this.instanceId}`
  private readonly onExpireCallbackName = `__recaptchaExpire_${this.instanceId}`
  private readonly onErrorCallbackName = `__recaptchaError_${this.instanceId}`

  // ControlValueAccessor plumbing.
  private onChange: (value: string) => void = () => {}
  private onTouched: () => void = () => {}

  ngAfterViewInit(): void {
    this.viewReady = true

    this.timeoutHandle = setTimeout(() => {
      if (!this.isLoaded) this.error.emit()
    }, this.loadingTimeout)

    if (this.version === 'v3') {
      if (this.hideBadge) {
        this.styleEl = document.createElement('style')
        this.styleEl.textContent = '.grecaptcha-badge { visibility: hidden; }'
        document.head.appendChild(this.styleEl)
      }
      this.loadScriptV3()
    } else {
      this.registerGlobalCallbacks()
      this.loadScript()
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-render when the sitekey changes (grecaptcha has no update API). v2 only.
    if (
      this.viewReady &&
      this.version === 'v2' &&
      changes['sitekey'] &&
      !changes['sitekey'].firstChange
    ) {
      this.currentWidgetId = null
      this.isLoaded = false
      this.containerRef.nativeElement.innerHTML = ''
      this.renderWidget()
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    if (this.pollHandle) clearInterval(this.pollHandle)
    if (this.styleEl) this.styleEl.remove()
    this.removeGlobalCallbacks()
    this.currentWidgetId = null
  }

  // Public API

  /** v2: reset the widget. v3: clear the last token. */
  reset(): void {
    this.lastToken = ''
    if (this.version === 'v2' && this.currentWidgetId !== null) {
      window.grecaptcha?.reset(this.currentWidgetId)
    }
    this.onChange('')
  }

  /**
   * Obtain a token. On v3, runs the challenge for `action` (or the `action`
   * input) and resolves with the token. On v2, triggers the challenge and
   * resolves when the next verify fires.
   */
  async execute(action?: string): Promise<string> {
    if (this.version === 'v3') {
      await this.v3Ready
      const g = window.grecaptcha
      if (!g) {
        this.error.emit()
        throw new Error('reCAPTCHA v3 is not loaded')
      }
      try {
        const token = await g.execute(this.sitekey, {
          action: action ?? this.action,
        })
        this.lastToken = token
        this.onChange(token)
        this.onTouched()
        this.verify.emit(token)
        return token
      } catch (err) {
        this.error.emit()
        throw err
      }
    }

    if (this.currentWidgetId === null) return ''
    window.grecaptcha?.execute(this.currentWidgetId)
    return new Promise<string>((resolve) => {
      this.pendingExecute = resolve
    })
  }

  /** Read the current token (last resolved token on v3) */
  getResponse(): string {
    if (this.version === 'v3') return this.lastToken
    if (this.currentWidgetId === null) return ''
    return window.grecaptcha?.getResponse(this.currentWidgetId) ?? ''
  }

  // ControlValueAccessor

  writeValue(value: string | null): void {
    // Writing an empty value resets the widget; any other value is owned by
    // grecaptcha and cannot be set programmatically, so we ignore it.
    if (!value && this.version === 'v2' && this.currentWidgetId !== null) {
      window.grecaptcha?.reset(this.currentWidgetId)
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn
  }

  // Internals

  private registerGlobalCallbacks(): void {
    const w = window as unknown as Record<string, unknown>
    w[this.onVerifyCallbackName] = (token: string) => {
      this.lastToken = token
      this.onChange(token)
      this.onTouched()
      this.verify.emit(token)
      if (this.pendingExecute) {
        this.pendingExecute(token)
        this.pendingExecute = null
      }
    }
    w[this.onExpireCallbackName] = () => {
      this.lastToken = ''
      this.onChange('')
      this.expire.emit()
    }
    w[this.onErrorCallbackName] = () => {
      this.lastToken = ''
      this.onChange('')
      this.error.emit()
    }
  }

  private removeGlobalCallbacks(): void {
    const w = window as unknown as Record<string, unknown>
    delete w[this.onLoadCallbackName]
    delete w[this.onVerifyCallbackName]
    delete w[this.onExpireCallbackName]
    delete w[this.onErrorCallbackName]
  }

  private renderWidget(): void {
    if (!this.containerRef || this.currentWidgetId !== null) return

    const g = window.grecaptcha
    if (!g || !g.render) return

    this.currentWidgetId = g.render(this.containerRef.nativeElement, {
      sitekey: this.sitekey,
      theme: this.theme,
      size: this.size,
      tabindex: this.tabindex,
      badge: this.badge,
      isolated: this.isolated,
      callback: this.onVerifyCallbackName,
      'expired-callback': this.onExpireCallbackName,
      'error-callback': this.onErrorCallbackName,
    })

    this.isLoaded = true
    if (this.currentWidgetId !== null) this.widgetId.emit(this.currentWidgetId)
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
  }

  private loadScript(): void {
    if (typeof window.grecaptcha?.render === 'function') {
      this.renderWidget()
      return
    }

    if (document.getElementById('google-recaptcha-script')) {
      this.waitForGrecaptcha()
      return
    }

    const w = window as unknown as Record<string, unknown>
    w[this.onLoadCallbackName] = () => this.renderWidget()

    const lang = this.language ? `&hl=${this.language}` : ''
    const src = `https://www.google.com/recaptcha/api.js?onload=${this.onLoadCallbackName}&render=explicit${lang}`

    const scriptEl = document.createElement('script')
    scriptEl.id = 'google-recaptcha-script'
    scriptEl.src = src
    scriptEl.async = true
    scriptEl.defer = true
    scriptEl.onerror = () => {
      this.error.emit()
      if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    }
    document.head.appendChild(scriptEl)
  }

  private waitForGrecaptcha(): void {
    this.pollHandle = setInterval(() => {
      if (typeof window.grecaptcha?.render === 'function') {
        if (this.pollHandle) clearInterval(this.pollHandle)
        this.renderWidget()
      }
    }, 100)
  }

  private markV3Ready(): void {
    window.grecaptcha?.ready(() => {
      this.isLoaded = true
      this.resolveV3Ready()
      if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    })
  }

  private loadScriptV3(): void {
    const scriptId = `google-recaptcha-v3-script-${this.sitekey}`

    if (typeof window.grecaptcha?.ready === 'function') {
      this.markV3Ready()
      return
    }

    if (document.getElementById(scriptId)) {
      this.pollHandle = setInterval(() => {
        if (typeof window.grecaptcha?.ready === 'function') {
          if (this.pollHandle) clearInterval(this.pollHandle)
          this.markV3Ready()
        }
      }, 100)
      return
    }

    const lang = this.language ? `&hl=${this.language}` : ''
    const scriptEl = document.createElement('script')
    scriptEl.id = scriptId
    scriptEl.src = `https://www.google.com/recaptcha/api.js?render=${this.sitekey}${lang}`
    scriptEl.async = true
    scriptEl.defer = true
    scriptEl.onload = () => this.markV3Ready()
    scriptEl.onerror = () => {
      this.error.emit()
      if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    }
    document.head.appendChild(scriptEl)
  }
}
