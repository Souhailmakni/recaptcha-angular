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
} from './recaptcha.types'

/**
 * Google reCAPTCHA v2 (checkbox) component for Angular.
 *
 * Loads the reCAPTCHA script once per page, renders the widget explicitly, and
 * is safe to use multiple times per page. Implements `ControlValueAccessor`, so
 * it works with `[(ngModel)]` and reactive `formControlName` (the verified token
 * is the control value).
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
  /** Your reCAPTCHA v2 site key from https://www.google.com/recaptcha/admin */
  @Input({ required: true }) sitekey!: string

  /** Widget color scheme. Default: 'light' */
  @Input() theme: RecaptchaTheme = 'light'

  /** Widget size. Default: 'normal' */
  @Input() size: RecaptchaSize = 'normal'

  /** Tab index of the widget. Default: 0 */
  @Input() tabindex = 0

  /** Timeout in ms before emitting `error` if the widget never loads. Default: 30000 */
  @Input() loadingTimeout = 30000

  /** Optional BCP 47 language code for the widget, e.g. 'fr', 'ar' */
  @Input() language = ''

  /** Position of the reCAPTCHA badge (only applies to invisible size). Default: 'bottomright' */
  @Input() badge: RecaptchaBadge = 'bottomright'

  /** Whether to isolate this widget from others on the page */
  @Input() isolated = false

  /** Emitted when the user successfully completes the challenge */
  @Output() verify = new EventEmitter<string>()

  /** Emitted when the response token expires */
  @Output() expire = new EventEmitter<void>()

  /** Emitted when reCAPTCHA encounters an error (network, script load, etc.) */
  @Output() error = new EventEmitter<void>()

  /** Emitted with the widget ID once the widget is rendered */
  @Output() widgetId = new EventEmitter<number>()

  @ViewChild('container', { static: true })
  private containerRef!: ElementRef<HTMLDivElement>

  private currentWidgetId: number | null = null
  private isLoaded = false
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private pollHandle: ReturnType<typeof setInterval> | null = null
  private viewReady = false

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
    this.registerGlobalCallbacks()

    this.timeoutHandle = setTimeout(() => {
      if (!this.isLoaded) this.error.emit()
    }, this.loadingTimeout)

    this.loadScript()
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-render when the sitekey changes (grecaptcha has no update API).
    if (this.viewReady && changes['sitekey'] && !changes['sitekey'].firstChange) {
      this.currentWidgetId = null
      this.isLoaded = false
      this.containerRef.nativeElement.innerHTML = ''
      this.renderWidget()
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    if (this.pollHandle) clearInterval(this.pollHandle)
    this.removeGlobalCallbacks()
    this.currentWidgetId = null
  }

  // Public API

  /** Reset the widget so the user can solve it again */
  reset(): void {
    if (this.currentWidgetId === null) return
    window.grecaptcha?.reset(this.currentWidgetId)
    this.onChange('')
  }

  /** Programmatically execute the challenge (invisible/size flows) */
  execute(): void {
    if (this.currentWidgetId === null) return
    window.grecaptcha?.execute(this.currentWidgetId)
  }

  /** Read the current response token straight from grecaptcha */
  getResponse(): string {
    if (this.currentWidgetId === null) return ''
    return window.grecaptcha?.getResponse(this.currentWidgetId) ?? ''
  }

  // ControlValueAccessor

  writeValue(value: string | null): void {
    // Writing an empty value resets the widget; any other value is owned by
    // grecaptcha and cannot be set programmatically, so we ignore it.
    if (!value && this.currentWidgetId !== null) {
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
      this.onChange(token)
      this.onTouched()
      this.verify.emit(token)
    }
    w[this.onExpireCallbackName] = () => {
      this.onChange('')
      this.expire.emit()
    }
    w[this.onErrorCallbackName] = () => {
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
}
