import { readFileSync } from 'fs'
import path from 'path'

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
    </>
  )
}
