export const dynamic = 'force-static';

const XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title>OneAtlas sitemap</title>
        <style>
          body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #0a0c11; color: #e8eaf0; margin: 0; }
          main { max-width: 880px; margin: 0 auto; padding: 40px 20px 64px; }
          h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
          p.note { color: #9aa3b5; font-size: 13px; line-height: 1.6; }
          ol { list-style: none; padding: 0; margin: 28px 0 0; }
          li { border-top: 1px solid #232838; padding: 7px 0; font-size: 13px; }
          a { color: #a5b4fc; text-decoration: none; word-break: break-all; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <main>
          <h1>Sitemap</h1>
          <p class="note">Every public URL on OneAtlas, generated from the catalogue mirror. Search engines read this file as XML; the stylesheet only changes what a human sees when opening it in a browser. <xsl:value-of select="count(sm:urlset/sm:url)"/> URLs.</p>
          <ol>
            <xsl:for-each select="sm:urlset/sm:url">
              <li><a><xsl:attribute name="href"><xsl:value-of select="sm:loc"/></xsl:attribute><xsl:value-of select="sm:loc"/></a></li>
            </xsl:for-each>
          </ol>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

/** GET /sitemap.xsl — renders /sitemap.xml as a readable list of URLs in a browser. Crawlers
 * read the XML itself and never apply the stylesheet. */
export function GET() {
  return new Response(XSL, {
    headers: { 'content-type': 'text/xsl; charset=utf-8', 'cache-control': 'public, s-maxage=86400' },
  });
}
