# recaptcha-angular

> Lightweight, zero-dependency Angular component for **Google reCAPTCHA v2 (checkbox)**
> with full TypeScript support, standalone APIs, and `ControlValueAccessor`
> (`ngModel` / reactive forms) integration.

[![npm](https://img.shields.io/npm/v/recaptcha-angular)](https://www.npmjs.com/package/recaptcha-angular)
[![license](https://img.shields.io/npm/l/recaptcha-angular)](LICENSE)

This is the Angular port of [`recaptcha-vue`](https://github.com/Souhailmakni/recaptcha-vue). Same features, Angular idioms.

---

## Features

- **Standalone** component (Angular 17+), no NgModule required
- **TypeScript**: full types for inputs, outputs, and the public methods
- **`RecaptchaService`**: signal-based `token` & `isVerified` state
- **Forms**: implements `ControlValueAccessor`, works with `[(ngModel)]` and `formControlName`
- **Multiple instances**: safe to use more than one widget per page
- **Theming**: `light` / `dark`, `normal` / `compact`
- **Language**: pass any BCP 47 code (`hl` param)
- **Load timeout**: emits `error` if the script never loads
- **Ivy partial-compilation** build via ng-packagr, zero runtime dependencies

---

## Installation

```bash
npm install recaptcha-angular
```

`@angular/core`, `@angular/common`, and `@angular/forms` (>= 17) are peer dependencies.

---

## Quick start

```ts
import { Component } from '@angular/core'
import { RecaptchaComponent, RecaptchaService } from 'recaptcha-angular'

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [RecaptchaComponent],
  providers: [RecaptchaService],
  template: `
    <recaptcha-v2
      sitekey="YOUR_SITE_KEY"
      (verify)="captcha.onVerify($event)"
      (expire)="captcha.onExpire()"
      (error)="captcha.onError()"
    ></recaptcha-v2>
    <button [disabled]="!captcha.isVerified()">Submit</button>
  `,
})
export class FormComponent {
  constructor(public captcha: RecaptchaService) {}
}
```

---

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `sitekey` | `string` | required | Your reCAPTCHA v2 site key |
| `theme` | `'light' \| 'dark'` | `'light'` | Widget color scheme |
| `size` | `'normal' \| 'compact'` | `'normal'` | Widget size |
| `tabindex` | `number` | `0` | Tab index of the widget |
| `loadingTimeout` | `number` | `30000` | ms before `error` fires if the script never loads |
| `language` | `string` | `''` | BCP 47 language code (`hl`) |
| `badge` | `'bottomright' \| 'bottomleft' \| 'inline'` | `'bottomright'` | Badge position |
| `isolated` | `boolean` | `false` | Isolate this widget from others |

## Outputs

| Output | Payload | Fires when |
|---|---|---|
| `verify` | `string` | Challenge solved |
| `expire` | `void` | Token expired |
| `error` | `void` | Network / script-load error or timeout |
| `widgetId` | `number` | Widget rendered |

---

## Public methods (via template ref)

```html
<recaptcha-v2 #captcha sitekey="..."></recaptcha-v2>
<button (click)="captcha.reset()">Retry</button>
```

- `reset()` resets the widget
- `execute()` triggers the challenge
- `getResponse()` returns the current token

---

## Forms integration

The verified token is the control value, so the component drops straight into
template-driven or reactive forms:

```html
<!-- template-driven -->
<recaptcha-v2 sitekey="..." [(ngModel)]="token" name="captcha"></recaptcha-v2>

<!-- reactive -->
<recaptcha-v2 sitekey="..." formControlName="captcha"></recaptcha-v2>
```

Setting the bound value to `''` resets the widget. Any other value is owned by
grecaptcha and cannot be written programmatically.

---

## `RecaptchaService`

Signal-based state, mirroring the Vue composable / React hook. Provide it at the
component level (not root) so each form gets its own instance.

```ts
captcha.token()       // Signal<string>
captcha.isVerified()  // computed Signal<boolean>
captcha.onVerify(t)   // wire to (verify)
captcha.onExpire()    // wire to (expire)
captcha.onError()     // wire to (error)
captcha.reset()       // clear tracked state
```

---

## Server-side verification

Always verify the token on your backend against
`https://www.google.com/recaptcha/api/siteverify` with your **secret** key. See
the `recaptcha-vue` repo for a ready-made Laravel controller and validation rule.

---

## Local development

```bash
npm install
npm run build   # builds the library into dist/recaptcha-angular
npm test        # runs the Karma/Jasmine specs headless
```

---

## License

MIT © Souhail Makni
