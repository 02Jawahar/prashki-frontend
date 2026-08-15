import { getCurrentUser } from '@/lib/server-auth'
import { productService } from '@/services/product.service'
import { AuthProvider } from '@/hooks/use-auth'
import { CartProvider } from '@/hooks/use-cart'
import { SiteHeader } from '@/components/storefront/site-header'
import { SiteFooter } from '@/components/storefront/site-footer'
import { CartDrawer } from '@/components/storefront/cart-drawer'
import type { NavItem, StoreSettings } from '@/types/api'

const FALLBACK_NAV: NavItem[] = [{ label: 'Shop', href: '/products' }]

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // Nav and store details are configuration, not code (spec §17, §37).
  let settings: StoreSettings = {}
  try {
    settings = (await productService.settings()).data.settings
  } catch {
    settings = {}
  }

  const nav = settings['nav.main']?.length ? settings['nav.main'] : FALLBACK_NAV
  const storeName = settings['store.name'] ?? 'Prash & Ki'
  const user = await getCurrentUser()

  return (
    <AuthProvider initialUser={user}>
      <CartProvider>
        <SiteHeader nav={nav} storeName={storeName} />
        <main>{children}</main>
        <SiteFooter nav={nav} settings={settings} />
        <CartDrawer />
      </CartProvider>
    </AuthProvider>
  )
}
