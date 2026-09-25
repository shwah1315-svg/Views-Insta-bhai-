const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
// 5 min ke liye cache karega taaki Imginn block na kare
const cache = new NodeCache({ stdTTL: 300 }); 

app.use(cors());
app.use(express.static('.'));

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36';

// 1. Image Proxy Router (Images ko block hone se bachane ke liye)
app.get('/api/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) return res.status(400).send('No URL');
        
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://imginn.com/'
            }
        });
        response.data.pipe(res);
    } catch (err) {
        res.status(500).send('Image Fetch Error');
    }
});

// 2. Direct Imginn Scraper Engine
async function scrapeImginn(username) {
    const url = `https://imginn.com/${username}/`;
    const response = await axios.get(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const $ = cheerio.load(response.data);

    // Imginn ke HTML elements se raw values nikalna
    const rawPic = $('.user-avatar img').attr('src') \vert{}\vert{}$('.profile-avatar img').attr('src') || '';
    const profilePic = rawPic ? `/api/proxy-image?url=${encodeURIComponent(rawPic)}` : 'https://via.placeholder.com/150';
    
    const displayName = $('.user-name').text().trim() \vert{}\vert{}$('.fullname').text().trim() || username;
    const bio = $('.user-bio').text().trim() \vert{}\vert{}$('.desc').text().trim() || '';
    
    const stats = [];
    $('.user-meta span, .stats span').each((i, el) => {
        const txt = $(el).text().trim();
        if (txt) stats.push(txt);
    });

    const posts = [];
    $('.media-list .item, .items .item').each((i, el) => {
        let img = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
        const isVideo = $(el).find('.icon-video, .video-icon').length > 0;
        if (img) {
            if (img.startsWith('//')) img = 'https:' + img;
            posts.push({ 
                img: `/api/proxy-image?url=${encodeURIComponent(img)}`, 
                isVideo 
            });
        }
    });

    if (!rawPic && posts.length === 0) {
        throw new Error('Imginn data empty');
    }

    return {
        success: true,
        username,
        displayName,
        profilePic,
        bio,
        postsCount: stats[0] || '0',
        followersCount: stats[1] || '0',
        followingCount: stats[2] || '0',
        posts
    };
}

// 3. Backup Scraper Engine (Picuki)
async function scrapePicuki(username) {
    const url = `https://www.picuki.com/profile/${username}`;
    const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const $ = cheerio.load(response.data);

    const rawPic = $('.profile-avatar img').attr('src') || '';
    const profilePic = rawPic ? `/api/proxy-image?url=${encodeURIComponent(rawPic)}` : 'https://via.placeholder.com/150';

    const displayName = $('.profile-name-bottom').text().trim() || username;
    const bio = $('.profile-description').text().trim() || '';

    const postsCount = $('.total_posts').text().trim() || '0';
    const followersCount = $('.followed_by').text().trim() || '0';
    const followingCount = $('.follows').text().trim() || '0';

    const posts = [];
    $('.box-photos .box-photo').each((i, el) => {
        let img = $(el).find('.post-image').attr('src');
        const isVideo = $(el).find('.video-icon').length > 0;
        if (img) {
            posts.push({
                img: `/api/proxy-image?url=${encodeURIComponent(img)}`,
                isVideo
            });
        }
    });

    return {
        success: true,
        username,
        displayName,
        profilePic,
        bio,
        postsCount,
        followersCount,
        followingCount,
        posts
    };
}

// API Endpoint
app.get('/api/user/:username', async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        
        // Cache Check
        if (cache.has(username)) {
            return res.json(cache.get(username));
        }

        let data;
        try {
            // Step 1: Direct Imginn se Data Laana
            data = await scrapeImginn(username);
        } catch (imginnErr) {
            // Step 2: Imginn Fail Hone Par Backup Picuki Se Data Laana
            data = await scrapePicuki(username);
        }

        cache.set(username, data);
        res.json(data);

    } catch (error) {
        res.status(500).json({ success: false, message: 'Data fetch failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
