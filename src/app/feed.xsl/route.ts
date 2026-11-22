export const dynamic = 'force-static';

const XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title><xsl:value-of select="rss/channel/title"/></title>
        <style>
          body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #0a0c11; color: #e8eaf0; margin: 0; }
          main { max-width: 760px; margin: 0 auto; padding: 40px 20px 64px; }
          h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
          p.note { color: #9aa3b5; font-size: 13px; line-height: 1.6; }
          ol { list-style: none; padding: 0; margin: 28px 0 0; }
          li { border-top: 1px solid #232838; padding: 14px 0; }
          a { color: #a5b4fc; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .item-title { font-size: 14px; }
          time, .desc { display: block; color: #9aa3b5; font-size: 12px; margin-top: 4px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="rss/channel/title"/></h1>
          <p class="note"><xsl:value-of select="rss/channel/description"/></p>
          <p class="note">This is an RSS feed. Paste this page's address into a feed reader to follow it, and the reader will poll the same URL for new entries.</p>
          <ol>
            <xsl:for-each select="rss/channel/item">
              <li>
                <a class="item-title"><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a>
                <time><xsl:value-of select="pubDate"/></time>
                <span class="desc"><xsl:value-of select="description"/></span>
              </li>
            </xsl:for-each>
          </ol>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

/** GET /feed.xsl — renders the RSS feeds (/changes.xml, per-model feed.xml) as a readable page
 * in a browser. Readers and scripts ignore the stylesheet entirely; it only changes what a
 * human sees when they open a feed URL directly. */
export function GET() {
  return new Response(XSL, {
    headers: { 'content-type': 'text/xsl; charset=utf-8', 'cache-control': 'public, s-maxage=86400' },
  });
}
