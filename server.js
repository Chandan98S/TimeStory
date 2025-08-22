const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

// Helper function to make HTTPS requests
function fetchTimeComHTML() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'time.com',
            port: 443,
            path: '/',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'close'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Much more lenient story extraction
function extractLatestStories(htmlContent) {
    const stories = [];
    const usedLinks = new Set();
    
    const html = htmlContent.toString();
    console.log('HTML length:', html.length);
    
    // Find ALL time.com URLs
    const urlPattern = /href="(https:\/\/time\.com\/[^"]+)"/gi;
    const allUrls = [];
    let match;
    
    while ((match = urlPattern.exec(html)) !== null) {
        allUrls.push({
            url: match[1],
            position: match.index
        });
    }
    
    console.log(`Found ${allUrls.length} total time.com URLs`);
    
    // Show first 10 URLs for debugging
    console.log('\nFirst 10 URLs found:');
    for (let i = 0; i < Math.min(10, allUrls.length); i++) {
        console.log(`${i + 1}. ${allUrls[i].url}`);
    }
    
    // Very lenient filtering - just exclude obvious non-articles
    const potentialArticles = [];
    const seen = new Set();
    
    for (let urlData of allUrls) {
        let url = urlData.url;
        
        // Clean up URL
        if (url.includes('?')) url = url.split('?')[0];
        if (url.includes('#')) url = url.split('#');
        url = url.replace(/\\+$/, ''); // Remove trailing slashes/backslashes
        url = url.replace(/"+$/, ''); // Remove trailing quotes
        
        // Skip duplicates
        if (seen.has(url)) continue;
        seen.add(url);
        
        // Only exclude obvious non-articles
        const excludePatterns = [
            'wp-content',
            '/img/',
            '/static/',
            '/css/',
            '/js/',
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.svg',
            '.pdf',
            '.css',
            '.js',
            'subscribe',
            'newsletter',
            'privacy-policy',
            'terms-of-service',
            'contact',
            'about'
        ];
        
        let shouldExclude = false;
        for (let pattern of excludePatterns) {
            if (url.toLowerCase().includes(pattern)) {
                shouldExclude = true;
                break;
            }
        }
        
        if (!shouldExclude && url.length > 30 && url.split('/').length >= 4) {
            potentialArticles.push({
                url: url,
                position: urlData.position
            });
        }
    }
    
    console.log(`\nFiltered to ${potentialArticles.length} potential articles:`);
    for (let i = 0; i < Math.min(15, potentialArticles.length); i++) {
        console.log(`${i + 1}. ${potentialArticles[i].url}`);
    }
    
    // Sort by position (earlier = more prominent)
    potentialArticles.sort((a, b) => a.position - b.position);
    
    // Extract titles for each URL
    for (let i = 0; i < potentialArticles.length && stories.length < 6; i++) {
        const article = potentialArticles[i];
        const url = article.url;
        
        if (usedLinks.has(url)) continue;
        
        console.log(`\nProcessing article ${i + 1}: ${url}`);
        
        // Try to extract title
        let title = extractTitleForArticle(html, article.position, url);
        
        if (!title || title.length < 5) {
            // Try harder to find a title
            title = findTitleInLargerArea(html, article.position) || generateTitleFromUrl(url);
        }
        
        if (title) {
            title = cleanTitle(title);
            console.log(`Found title: "${title}"`);
            
            // Very lenient validation
            if (title && 
                title.length >= 5 && 
                title.length <= 500 &&
                !title.match(/^(home|menu|search|login|sign|subscribe|click|read|view|see|watch|more|here|link|url|image|photo)$/i)) {
                
                usedLinks.add(url);
                stories.push({
                    title: title,
                    link: url
                });
                console.log(`✓ Added story ${stories.length}: "${title}"`);
            } else {
                console.log(`✗ Title rejected: "${title}" (length: ${title ? title.length : 0})`);
            }
        } else {
            console.log(`✗ No title found`);
        }
    }
    
    return stories;
}

// Extract title with multiple methods
function extractTitleForArticle(html, position, url) {
    // Method 1: Look for link text
    const linkTitle = findLinkText(html, position);
    if (linkTitle && linkTitle.length >= 10) return linkTitle;
    
    // Method 2: Look in surrounding area
    const nearbyTitle = findNearbyTitle(html, position);
    if (nearbyTitle && nearbyTitle.length >= 10) return nearbyTitle;
    
    return null;
}

// Find title in link text
function findLinkText(html, position) {
    try {
        const linkStart = html.indexOf('>', position);
        if (linkStart === -1) return null;
        
        const linkEnd = html.indexOf('</a>', linkStart);
        if (linkEnd === -1 || linkEnd - linkStart > 1000) return null;
        
        const linkContent = html.substring(linkStart + 1, linkEnd);
        return cleanTitle(linkContent);
    } catch (e) {
        return null;
    }
}

// Find title in nearby area
function findNearbyTitle(html, position) {
    try {
        const start = Math.max(0, position - 3000);
        const end = Math.min(html.length, position + 3000);
        const area = html.substring(start, end);
        
        // Look for various title patterns
        const patterns = [
            /<h[1-6][^>]*>([^<]+(?:<[^>]*>[^<]*)*?)<\/h[1-6]>/gi,
            /<title>([^<]+)<\/title>/gi,
            /title="([^"]+)"/gi,
            /<span[^>]*>([^<]+(?:<[^>]*>[^<]*)*?)<\/span>/gi
        ];
        
        for (let pattern of patterns) {
            let match;
            const titles = [];
            
            while ((match = pattern.exec(area)) !== null) {
                const title = cleanTitle(match[1]);
                if (title && title.length >= 15 && title.length <= 200) {
                    titles.push(title);
                }
            }
            
            if (titles.length > 0) {
                // Return longest title
                titles.sort((a, b) => b.length - a.length);
                return titles[0];
            }
        }
    } catch (e) {
        // Ignore errors
    }
    
    return null;
}

// Find title in much larger area
function findTitleInLargerArea(html, position) {
    try {
        const start = Math.max(0, position - 5000);
        const end = Math.min(html.length, position + 2000);
        const area = html.substring(start, end);
        
        // Look for any substantial text that could be a title
        const textPattern = />([^<]+)</g;
        const candidates = [];
        let match;
        
        while ((match = textPattern.exec(area)) !== null) {
            const text = cleanTitle(match[1]);
            if (text && 
                text.length >= 15 && 
                text.length <= 300 &&
                !text.match(/^(subscribe|sign|login|menu|search|home|news|time|click|read|view|see|watch|more|here|advertisement|ad)$/i) &&
                text.split(' ').length >= 3) {
                candidates.push(text);
            }
        }
        
        if (candidates.length > 0) {
            // Return the longest candidate
            candidates.sort((a, b) => b.length - a.length);
            return candidates[0];
        }
    } catch (e) {
        // Ignore errors
    }
    
    return null;
}

// Generate title from URL
function generateTitleFromUrl(url) {
    try {
        const parts = url.split('/');
        let slug = '';
        
        // Find the last meaningful part
        for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i] && parts[i].length > 3 && !parts[i].match(/^\d+$/)) {
                slug = parts[i];
                break;
            }
        }
        
        if (slug && slug.length > 5) {
            return slug
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .trim();
        }
    } catch (e) {
        // Ignore errors
    }
    
    return null;
}

// Clean title text
function cleanTitle(text) {
    if (!text) return '';
    
    let cleaned = text.toString();
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, ' ');
    
    // Decode HTML entities
    cleaned = cleaned.replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&#x27;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&rsquo;/g, "'")
                    .replace(/&lsquo;/g, "'")
                    .replace(/&rdquo;/g, '"')
                    .replace(/&ldquo;/g, '"');
    
    // Clean whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        if (pathname === '/getTimeStories' && method === 'GET') {
            console.log('Fetching latest stories from Time.com...');
            
            const htmlContent = await fetchTimeComHTML();
            const stories = extractLatestStories(htmlContent);
            
            console.log(`\n=== FINAL RESULT ===`);
            console.log(`Extracted ${stories.length} stories:`);
            stories.forEach((story, i) => {
                console.log(`${i + 1}. ${story.title}`);
                console.log(`   ${story.link}\n`);
            });
            
            res.writeHead(200);
            res.end(JSON.stringify(stories, null, 2));
            
        } else if (pathname === '/debug' && method === 'GET') {
            const htmlContent = await fetchTimeComHTML();
            const stories = extractLatestStories(htmlContent);
            
            res.writeHead(200);
            res.end(JSON.stringify({
                htmlLength: htmlContent.length,
                storiesFound: stories.length,
                stories: stories
            }, null, 2));
            
        } else if (pathname === '/' && method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                message: 'Time.com Stories API - Lenient Version',
                endpoints: {
                    'GET /getTimeStories': 'Get latest 6 stories from Time.com',
                    'GET /debug': 'Debug extraction process'
                }
            }));
            
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }
        
    } catch (error) {
        console.error('Error processing request:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({
            error: 'Failed to fetch stories',
            message: error.message
        }));
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/getTimeStories`);
    console.log(`Debug endpoint: http://localhost:${PORT}/debug`);
});
