const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('.'));

// Scraping API Endpoint
app.get('/api/user/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const url = `https://imginn.com/${username}/`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);

        const profilePic = $('.user-avatar img').attr('src') || '';
        const displayName = $('.user-name').text().trim() || username;
        const bio = $('.user-bio').text().trim() || '';
        
        const stats = $('.user-meta span').map((i, el) =>$(el).text().trim()).get();
        
        const posts = [];
        $('.media-list .item').each((i, el) => {
            const img = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
            const isVideo = $(el).find('.icon-video').length > 0;
            if (img) {
                posts.push({ img, isVideo });
            }
        });

        res.json({
            success: true,
            username,
            displayName,
            profilePic,
            bio,
            postsCount: stats[0] || '0',
            followersCount: stats[1] || '0',
            followingCount: stats[2] || '0',
            posts
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'User not found or Scraping failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
