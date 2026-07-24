# recaptcha-angular

> Lightweight, zero-dependency Angular component for **Google reCAPTCHA v2 (checkbox) and v3 (score-based)**
> with full TypeScript support, standalone APIs, and `ControlValueAccessor`
> (`ngModel` / reactive forms) integration. Switch between v2 and v3 with a single `version` input.

[![npm](https://img.shields.io/npm/v/recaptcha-angular)](https://www.npmjs.com/package/recaptcha-angular)
[![license](https://img.shields.io/npm/l/recaptcha-angular)](LICENSE)
[![CI](https://github.com/Souhailmakni/recaptcha-angular/actions/workflows/ci.yml/badge.svg)](https://github.com/Souhailmakni/recaptcha-angular/actions)

Coverage (generated locally with `npm run test:coverage`, no external service):

| Statements | Branches | Functions | Lines |
|---|---|---|---|
| ![Statements](https://img.shields.io/badge/statements-96.84%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-88.46%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-97.36%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-97.64%25-brightgreen.svg?style=flat) |

This is the Angular port of [`recaptcha-vue`](https://github.com/Souhailmakni/recaptcha-vue). Same behaviour, Angular idioms.

---

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Token expiry and resetting](#token-expiry-and-resetting)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Public methods](#public-methods-via-template-ref)
- [reCAPTCHA v3](#recaptcha-v3)
- [Forms integration](#forms-integration)
- [`RecaptchaService`](#recaptchaservice)
- [Server-side verification](#server-side-verification)
- [Multiple instances on one page](#multiple-instances-on-one-page)
- [Local development](#local-development)
- [License](#license)

---

## Features

- **v2 and v3** in one component: `version="v2"` (default) or `version="v3"`
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

## Requirements

| | Version |
|---|---|
| Node.js | `>=20.19.0` (see [`.nvmrc`](.nvmrc)) |
| Angular | `>=17.0.0` (peer dependency) |

`@angular/core`, `@angular/common`, and `@angular/forms` are peer dependencies.

---

## Installation

```bash
npm install recaptcha-angular
```

---

## Quick start

### 1. Get your reCAPTCHA v2 keys

Register at [https://www.google.com/recaptcha/admin](https://www.google.com/recaptcha/admin).
Choose **reCAPTCHA v2 -> "I'm not a robot" Checkbox**.

> **Test keys** (always pass, never use in production):
> Site key: `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
> Secret key: `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

### 2. Use the component

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

## Token expiry and resetting

> [!IMPORTANT]
> Read this before wiring up a form. The most common integration bug with any
> reCAPTCHA v2 wrapper is a form that works once in testing, then silently
> submits a stale or already-used token in production. (Separately: your server
> must verify the token regardless of expiry, see
> [Client state is not verification](#client-state-is-not-verification).)

A verified token is only valid for **about 2 minutes** ([Google's own limit](https://developers.google.com/recaptcha/docs/faq#my-users-are-getting-a-please-try-again-error-why)),
and it's **single-use**: once you've submitted it to your backend, that exact
token cannot be verified again, whether verification succeeded or failed. Two
failure modes follow directly from that:

1. **The user waits too long.** The checkbox stays visually "checked," but the
   token behind it has expired. Handle this with the `(expire)` output (wired to
   `RecaptchaService.onExpire`), which flips `isVerified()` back to `false` so
   your submit button disables itself again instead of sending a dead token.
2. **The user submits, something else fails, they retry.** Say the token verifies
   fine but a different field fails server-side validation. If you don't reset the
   widget, the user fixes that field and resubmits the *same* token, which your
   backend now rejects, and it looks like reCAPTCHA itself is broken.

The fix for both is the same one-liner, and it belongs in every code path that
leaves the form, success or failure. Grab the component with a template ref and
call `reset()`:

```html
<recaptcha-v2 #captcha sitekey="..."></recaptcha-v2>
```

```ts
@ViewChild('captcha') captcha!: RecaptchaComponent
// ...
this.captcha.reset()
```

---

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `sitekey` | `string` | **required** | Your reCAPTCHA site key |
| `version` | `'v2' \| 'v3'` | `'v2'` | Which reCAPTCHA to use. See [reCAPTCHA v3](#recaptcha-v3) |
| `action` | `string` | `'submit'` | **v3 only.** Default action when `execute()` is called with no argument |
| `theme` | `'light' \| 'dark'` | `'light'` | **v2 only.** Widget color scheme |
| `size` | `'normal' \| 'compact'` | `'normal'` | **v2 only.** Widget size |
| `tabindex` | `number` | `0` | **v2 only.** Tab index |
| `loadingTimeout` | `number` | `30000` | ms before `error` fires if the script never loads |
| `language` | `string` | `''` | BCP 47 language code, e.g. `'fr'`, `'ar'` |
| `badge` | `'bottomright' \| 'bottomleft' \| 'inline'` | `'bottomright'` | **v2 only.** Badge position (invisible size only) |
| `hideBadge` | `boolean` | `false` | **v3 only.** Hide the floating badge (see the legal note in [reCAPTCHA v3](#recaptcha-v3)) |
| `isolated` | `boolean` | `false` | **v2 only.** Isolate widget from others on the page |

---

## Outputs

| Output | Payload | Fires when |
|---|---|---|
| `verify` | `string` | User completed the challenge; token ready to send to server |
| `expire` | `void` | Token expired; user must re-verify |
| `error` | `void` | Widget or network error, or load timeout |
| `widgetId` | `number` | Widget rendered (internal widget id) |

"Ready to send to server" is doing a lot of work in that first row. See
[Client state is not verification](#client-state-is-not-verification) for why
sending it isn't the same as being verified.

---

## Public methods (via template ref)

```html
<recaptcha-v2 #captcha sitekey="..."></recaptcha-v2>
<button (click)="captcha.reset()">Retry</button>
```

- `reset()` resets the widget (v2) or clears the token (v3)
- `execute(action?)` returns `Promise<string>`. On v3 it runs the challenge for the action and resolves with the token; on v2 it triggers the challenge and resolves when the next verify fires
- `getResponse()` returns the current token string

---

## reCAPTCHA v3

reCAPTCHA v3 is score-based and renders **no widget**: there is nothing to click.
Set `version="v3"` and get a token on demand by calling `execute(action)`,
usually right before you submit. `(verify)` still fires with the token, so
`RecaptchaService` works exactly as it does for v2.

```ts
import { Component, ViewChild } from '@angular/core'
import { RecaptchaComponent } from 'recaptcha-angular'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RecaptchaComponent],
  template: `
    <form (ngSubmit)="submit()">
      <!-- No visible widget on v3, just the floating badge -->
      <recaptcha-v2 #captcha sitekey="YOUR_V3_SITE_KEY" version="v3"></recaptcha-v2>
      <button type="submit">Log in</button>
    </form>
  `,
})
export class LoginComponent {
  @ViewChild('captcha') captcha!: RecaptchaComponent

  async submit() {
    const token = await this.captcha.execute('login')
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 'g-recaptcha-response': token }),
    })
  }
}
```

Notes specific to v3:

- **Get a fresh token per submit.** v3 tokens are single-use and expire in about
  2 minutes, so call `execute()` at submit time, not on init.
- **The badge and the law.** v3 shows a floating "protected by reCAPTCHA" badge.
  You may hide it with `hideBadge`, but only if you then display the
  [required legal text](https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge-what-is-allowed)
  yourself.
- **Server-side gives you a score.** `siteverify` returns `score` (0.0 to 1.0)
  and `action`. Reject low scores and confirm the action matches.
- **One version per page.** Rendering a v2 and a v3 instance on the same page is
  not supported (they share Google's single `grecaptcha` global). Pick one.

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
grecaptcha and cannot be written programmatically, so it's ignored.

---

## `RecaptchaService`

Signal-based state, mirroring the Vue composable / React hook. Provide it at the
component level (not root) so each form gets its own instance.

```ts
captcha.token()       // Signal<string>: current token ('' when expired / error)
captcha.isVerified()  // computed Signal<boolean> (client-side only, see below)
captcha.onVerify(t)   // wire to (verify)
captcha.onExpire()    // wire to (expire)
captcha.onError()     // wire to (error)
captcha.reset()       // clear the tracked state (call component.reset() too)
```

### Client state is not verification

> [!WARNING]
> `isVerified()` and `token()` are client-side state only. They exist to drive
> UX, e.g. disabling the submit button until the checkbox is solved, and they are
> never proof that verification actually happened. Any client can set them to
> whatever it wants before the request reaches your server.
>
> Your server must independently POST the token to
> `https://www.google.com/recaptcha/api/siteverify` with your secret key, check
> the `success` field, and reject the request when it's false. See
> [Server-side verification](#server-side-verification) below.
>
> Tokens are also single-use and expire after about 2 minutes (see
> [Token expiry and resetting](#token-expiry-and-resetting)). A reused or expired
> token comes back from `siteverify` as `success: false` with
> `error-codes: ["timeout-or-duplicate"]`.

---

## Server-side verification

Always verify the token on your backend against
`https://www.google.com/recaptcha/api/siteverify` with your **secret** key. See
[`examples/contact.component.ts`](examples/contact.component.ts) for a full form,
and the [`recaptcha-vue`](https://github.com/Souhailmakni/recaptcha-vue) repo for
a ready-made Laravel controller and validation rule.

---

## Multiple instances on one page

Each `<recaptcha-v2>` instance manages its own unique widget id and global
callback names, so you can safely render more than one widget:

```html
<recaptcha-v2 [sitekey]="siteKey" (verify)="onLogin($event)"></recaptcha-v2>
<recaptcha-v2 [sitekey]="siteKey" (verify)="onSignup($event)"></recaptcha-v2>
```

---

## Local development

```bash
git clone https://github.com/Souhailmakni/recaptcha-angular.git
cd recaptcha-angular
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run build` | Build the library into `dist/recaptcha-angular` with ng-packagr |
| `npm test` | Run the Karma/Jasmine specs headless once |
| `npm run test:watch` | Run the specs in watch mode |
| `npm run test:coverage` | Run the specs with coverage and update the README badges |
| `npm run pack` | Build, then `npm pack` the publishable tarball for inspection |

Publishing is done from the built output:

```bash
npm run build && cd dist/recaptcha-angular && npm publish --access public
```

---

## License

[MIT](LICENSE) © Souhail Makni
