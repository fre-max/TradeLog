/**
 * Installe les binaires natifs sharp pour linux-x64.
 * - Sur Vercel (build Linux) : garantit les libs au runtime serverless
 * - En local (Windows/macOS) : prépare le lockfile pour le déploiement
 */
import { execSync } from 'node:child_process'
import { arch, platform } from 'node:os'

const isVercel = process.env.VERCEL === '1'
const isLinuxX64 = platform() === 'linux' && arch() === 'x64'

if (isVercel || !isLinuxX64) {
  console.log('[ensure-sharp] Binaires sharp linux-x64…')
  execSync(
    'npm install --no-save --include=optional --os=linux --cpu=x64 sharp',
    { stdio: 'inherit', shell: true },
  )
}
