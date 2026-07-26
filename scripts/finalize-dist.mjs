import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const distDir = 'dist/recaptcha-angular'

// Ship the README and LICENSE with the published package (ng-packagr does not
// copy them from the workspace root).
copyFileSync('README.md', `${distDir}/README.md`)
copyFileSync('LICENSE', `${distDir}/LICENSE`)

// ng-packagr always injects a tslib dependency, but the library is built with
// importHelpers:false, so no tslib import is emitted (verify: the fesm bundles
// contain no tslib references). Drop the unused dependency to keep the published
// package truly zero-dependency, consistent with recaptcha-react and recaptcha-vue.
const pkgPath = `${distDir}/package.json`
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
delete pkg.dependencies
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log('finalize-dist: copied README + LICENSE, removed injected dependencies')
