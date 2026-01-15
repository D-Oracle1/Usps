import { readFileSync } from 'fs'
import path from 'path'
import HomepageTrackingHandler from '@/components/homepage-tracking-handler'

export const metadata = {
  title: 'Welcome | USPS',
  icons: {
    icon: '/assets/images/home/favicon.ico',
  },
}

export default function HomePage() {
  // Read the static HTML file from public folder
  const htmlPath = path.join(process.cwd(), 'public', 'usps-home.html')
  let htmlContent = readFileSync(htmlPath, 'utf-8')

  // Update tracking links to point to our /track page
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/go\/TrackConfirmAction_input/g,
    '/track'
  )

  // Update login/register links to point to our auth pages
  htmlContent = htmlContent.replace(
    /https:\/\/reg\.usps\.com\/entreg\/LoginAction_input[^"']*/g,
    '/auth/login'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/reg\.usps\.com\/entreg\/RegistrationAction_input[^"']*/g,
    '/auth/register'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/reg\.usps\.com[^"']*/g,
    '/auth/login'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/sso\.usps\.com[^"']*/g,
    '/auth/login'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/acct\/activation[^"']*/g,
    '/auth/register'
  )

  // Replace sign in/sign up/register/login text links
  htmlContent = htmlContent.replace(
    /href="[^"]*signin[^"]*"/gi,
    'href="/auth/login"'
  )
  htmlContent = htmlContent.replace(
    /href="[^"]*sign-in[^"]*"/gi,
    'href="/auth/login"'
  )
  htmlContent = htmlContent.replace(
    /href="[^"]*signup[^"]*"/gi,
    'href="/auth/register"'
  )
  htmlContent = htmlContent.replace(
    /href="[^"]*sign-up[^"]*"/gi,
    'href="/auth/register"'
  )
  htmlContent = htmlContent.replace(
    /href="[^"]*register[^"]*usps[^"]*"/gi,
    'href="/auth/register"'
  )
  htmlContent = htmlContent.replace(
    /href="[^"]*login[^"]*usps[^"]*"/gi,
    'href="/auth/login"'
  )

  // Update location finder links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/locations\/?/g,
    '/help/find-location.html'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/find-location\.htm[^"']*/g,
    '/help/find-location.html'
  )

  // Update ZIP code lookup links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/go\/ZipLookupAction_input/g,
    '/zip-lookup'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/zip-code-lookup\.htm/g,
    '/zip-lookup'
  )

  // Update schedule pickup links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/schedule-pickup-steps\.htm/g,
    '/help/schedule-pickup-steps.html'
  )

  // Update redelivery links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/redelivery\.htm/g,
    '/manage/index.html'
  )

  // Update Click-N-Ship links
  htmlContent = htmlContent.replace(
    /https:\/\/cns\.usps\.com[^"']*/g,
    '/ship/online-shipping.html'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/cnsb\.usps\.com[^"']*/g,
    '/ship/online-shipping.html'
  )

  // Update Informed Delivery links
  htmlContent = htmlContent.replace(
    /https:\/\/informeddelivery\.usps\.com[^"']*/g,
    '/manage/informed-delivery.html'
  )

  // Update Store/Shop links
  htmlContent = htmlContent.replace(
    /https:\/\/store\.usps\.com[^"']*/g,
    '/store/go-now.html'
  )

  // Update PO Box links
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/poboxes[^"']*/g,
    '/manage/po-boxes.html'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/pobox[^"']*/g,
    '/manage/po-boxes.html'
  )

  // Update Hold Mail links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/holdmail[^"']*/g,
    '/manage/hold-mail.html'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/holdmail\.usps\.com[^"']*/g,
    '/manage/hold-mail.html'
  )

  // Update Change of Address / Forward Mail links
  htmlContent = htmlContent.replace(
    /https:\/\/moversguide\.usps\.com[^"']*/g,
    '/manage/forward.html'
  )

  // Update customs forms links
  htmlContent = htmlContent.replace(
    /https:\/\/cfo\.usps\.com[^"']*/g,
    '/international/customs-forms.html'
  )

  // Update price calculator links
  htmlContent = htmlContent.replace(
    /https:\/\/postcalc\.usps\.com[^"']*/g,
    '/business/prices.html'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com\/go\/CalculatePostage[^"']*/g,
    '/business/prices.html'
  )

  // Update Every Door Direct Mail links
  htmlContent = htmlContent.replace(
    /https:\/\/eddm\.usps\.com[^"']*/g,
    '/business/every-door-direct-mail.html'
  )

  // Update www.usps.com section links to local HTML pages
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/ship\//g,
    '/ship/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/manage\//g,
    '/manage/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/business\//g,
    '/business/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/international\//g,
    '/international/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/help\//g,
    '/help/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/shop\//g,
    '/shop/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/customer-service\//g,
    '/customer-service/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/globals\//g,
    '/globals/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/faqs\//g,
    '/faqs/'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/smallbusiness/g,
    '/smallbusiness'
  )

  // Update search form actions to our search page
  htmlContent = htmlContent.replace(
    /action="https:\/\/www\.usps\.com\/search[^"]*"/g,
    'action="/search"'
  )

  // Update remaining tools.usps.com links
  htmlContent = htmlContent.replace(
    /https:\/\/tools\.usps\.com[^"']*/g,
    '/help/find-location.html'
  )

  // Update any remaining www.usps.com links to root
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/?["']/g,
    '/"'
  )
  htmlContent = htmlContent.replace(
    /https:\/\/www\.usps\.com\/index\.html/g,
    '/'
  )

  // Fix asset paths to work with Next.js public folder
  htmlContent = htmlContent.replace(/href="assets\//g, 'href="/assets/')
  htmlContent = htmlContent.replace(/src="assets\//g, 'src="/assets/')
  htmlContent = htmlContent.replace(/href="global-elements\//g, 'href="/global-elements/')
  htmlContent = htmlContent.replace(/src="global-elements\//g, 'src="/global-elements/')
  htmlContent = htmlContent.replace(/url\(assets\//g, 'url(/assets/')
  htmlContent = htmlContent.replace(/url\(global-elements\//g, 'url(/global-elements/')

  // Extract body content
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  let bodyContent = bodyMatch ? bodyMatch[1] : ''

  // Remove script tags to prevent client-side errors
  bodyContent = bodyContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Extract all style blocks (both in head and inline in body)
  const allStyleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []
  let combinedStyles = allStyleMatches
    .map(s => s.replace(/<\/?style[^>]*>/gi, ''))
    .join('\n')

  // Fix URLs in styles
  combinedStyles = combinedStyles.replace(/url\(assets\//g, 'url(/assets/')
  combinedStyles = combinedStyles.replace(/url\(global-elements\//g, 'url(/global-elements/')

  return (
    <>
      <link rel="stylesheet" href="/assets/css/welcome/bootstrap.css" />
      <link rel="stylesheet" href="/global-elements/header/css/megamenu-v4.css" />
      <style dangerouslySetInnerHTML={{ __html: combinedStyles }} />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
      <HomepageTrackingHandler />
    </>
  )
}
